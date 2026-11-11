'use client';

import React, { useState, useMemo } from 'react';
import {
  Table,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  X,
  Trash2,
  Calendar,
  Sparkles,
  Info,
  CheckSquare,
  Square,
  FileSpreadsheet,
  Download,
} from 'lucide-react';
import {
  parseBulkTransactions,
  BulkParsedRow,
} from '@/lib/bulk-transaction-parser';
import { HouseholdCategory, DEFAULT_HOUSEHOLD_CATEGORIES } from '@/lib/household-categories';
import { formatDateToYMD } from '@/lib/quick-transaction-parser';

interface BulkTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories?: HouseholdCategory[];
  currentMonth?: string;
  existingTransactions?: any[];
  onSuccess?: (importedMonth?: string) => void;
}

const SAMPLE_DATA = `날짜\t내용\t금액\t대분류\t소분류\t지출 방법\t태그\t메모
2026-09-15\t스타벅스 강남점\t5,500\t식비\t외식\t우리카드\t#카페\t친구랑 커피
null\t넷플릭스 정기결제\t17,000\t생활용품\t구독\t토스뱅크\t#구독\t월정액
-\t급여 입금\t+3,500,000\t근로소득\t급여\t우리WON\t#월급\t9월 급여
2026-09-18\t이마트 역삼점\t48,900\t식비\t장보기\t우리카드\t#생필품\t장보기`;

const SAMPLE_CSV = [
  ['날짜', '내용', '금액', '대분류', '소분류', '지출 방법', '태그', '메모'],
  ['2026-09-15', '스타벅스 강남점', '5,500', '식비', '외식', '우리카드', '#카페', '친구랑 커피'],
  ['2026-09-16', '급여 입금', '+3,500,000', '근로소득', '급여', '우리WON', '#월급', '9월 급여'],
  ['2026-09-18', '이마트 역삼점', '48,900', '식비', '장보기', '우리카드', '#생필품', '장보기'],
].map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(',')).join('\r\n');

export default function BulkTransactionModal({
  isOpen,
  onClose,
  categories = DEFAULT_HOUSEHOLD_CATEGORIES,
  currentMonth = formatDateToYMD(new Date()).slice(0, 7),
  existingTransactions = [],
  onSuccess,
}: BulkTransactionModalProps) {
  const [rawText, setRawText] = useState('');
  const [targetMonth, setTargetMonth] = useState(currentMonth);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [fetchedTransactions, setFetchedTransactions] = useState<any[]>([]);

  // Fetch transactions for targetMonth to check duplicates against entire month in DB
  React.useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    const loadMonthTransactions = async () => {
      try {
        const res = await fetch(`/api/card-transactions?month=${targetMonth}&limit=1000`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data.transactions)) {
            setFetchedTransactions(data.transactions);
          }
        }
      } catch (err) {
        console.warn('Failed to pre-fetch transactions for duplicate checking:', err);
      }
    };
    loadMonthTransactions();
    return () => {
      isMounted = false;
    };
  }, [isOpen, targetMonth]);

  // Combine passed existingTransactions and fetched month transactions
  const combinedExistingTransactions = useMemo(() => {
    const map = new Map<string, any>();
    for (const t of existingTransactions) {
      if (t?.id) map.set(t.id, t);
    }
    for (const t of fetchedTransactions) {
      if (t?.id) map.set(t.id, t);
    }
    return Array.from(map.values());
  }, [existingTransactions, fetchedTransactions]);

  // Parse text whenever rawText, targetMonth, or combinedExistingTransactions changes
  const parseResult = useMemo(() => {
    return parseBulkTransactions(rawText, targetMonth, categories, combinedExistingTransactions);
  }, [rawText, targetMonth, categories, combinedExistingTransactions]);

  // Synchronize selection when rows change: exclude duplicate rows by default
  React.useEffect(() => {
    const validNonDuplicateIndices = new Set(
      parseResult.rows.filter((r) => r.isValid && !r.isDuplicate).map((r) => r.index)
    );
    setSelectedIndices(validNonDuplicateIndices);
  }, [parseResult.rows]);

  if (!isOpen) return null;

  const toggleSelectAll = () => {
    const validNonDuplicateRows = parseResult.rows.filter((r) => r.isValid && !r.isDuplicate);
    if (selectedIndices.size === validNonDuplicateRows.length && validNonDuplicateRows.length > 0) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(validNonDuplicateRows.map((r) => r.index)));
    }
  };

  const toggleSelectRow = (index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleRemoveRow = (index: number) => {
    // Remove the line from rawText
    const lines = rawText.split(/\r?\n/);
    let currentIdx = 0;
    const newLines = lines.filter((line, i) => {
      if (i === 0 && (line.includes('날짜') && line.includes('금액'))) {
        return true;
      }
      currentIdx++;
      return currentIdx !== index;
    });
    setRawText(newLines.join('\n'));
  };

  const downloadSampleCsv = () => {
    const blob = new Blob([`\uFEFF${SAMPLE_CSV}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '가계부-거래-샘플.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async () => {
    // Only import non-duplicate valid rows
    const selectedRows = parseResult.rows.filter(
      (r) => selectedIndices.has(r.index) && r.isValid && !r.isDuplicate
    );
    if (selectedRows.length === 0) {
      if (parseResult.duplicateCount > 0 && parseResult.validCount === 0) {
        setErrorMsg('모든 거래 내역이 이미 등록되어 있거나 중복되어 등록할 수 없습니다.');
      } else {
        setErrorMsg('등록할 유효한 거래 내역을 1건 이상 선택해주세요.');
      }
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payloadTransactions = selectedRows.map((r) => ({
        sourceApp: r.sourceApp,
        type: r.type,
        amount: r.amount,
        merchant: r.content,
        category: r.mainCategory,
        title: r.title,
        content: r.formattedContent,
        cardOrAccount: r.cardOrAccount,
        notifiedAt: new Date(`${r.dateStr}T12:00:00+09:00`).toISOString(),
        isReported: false,
        rawData: {
          manual: true,
          bulkImport: true,
          isMonthFallback: r.isMonthFallback,
          targetMonth,
          tag: r.tag,
          memo: r.memo,
          mainCategory: r.mainCategory,
          subCategory: r.subCategory,
          importedAt: new Date().toISOString(),
        },
      }));

      const res = await fetch('/api/card-transactions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: payloadTransactions }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '대량 등록 중 오류가 발생했습니다.');
      }

      const importedMonth = selectedRows[0]?.dateStr ? selectedRows[0].dateStr.slice(0, 7) : targetMonth;
      setSuccessMsg(data.message || `${selectedRows.length}건 등록 완료!`);
      setRawText('');
      onSuccess?.(importedMonth);

      setTimeout(() => {
        onClose();
      }, 400);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : '등록 실패');
    } finally {
      setSubmitting(false);
    }
  };

  const fallbackCount = parseResult.rows.filter((r) => r.isMonthFallback).length;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        zIndex: 120,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '1050px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '16px',
          border: '1.5px solid rgba(59, 130, 246, 0.4)',
          boxShadow: '0 20px 60px rgba(15, 23, 42, 0.2)',
          background: 'var(--surface-color)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--surface-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--ledger-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #3b82f6, #10b981)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 10px rgba(59, 130, 246, 0.4)',
              }}
            >
              <Table size={18} color="#fff" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                거래 내역 장부 대량(벌크) 복붙 등록
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    color: 'var(--ledger-info)',
                    background: 'rgba(59, 130, 246, 0.15)',
                    padding: '2px 8px',
                    borderRadius: '12px',
                  }}
                >
                  웹 테이블 · 엑셀 · 스프레드시트 복붙
                </span>
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                테이블에서 복사(⌘C/Ctrl+C)한 뒤 아래에 붙여넣기(⌘V/Ctrl+V)하면 헤더와 컬럼을 자동으로 분석합니다.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'var(--ledger-control-bg)',
              border: 'none',
              borderRadius: '8px',
              color: 'var(--text-muted)',
              padding: '6px',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Header Format Guide & Options */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              fontSize: '0.78rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, color: 'var(--ledger-info)' }}>📋 헤더 컬럼 순서:</span>
              <code style={{ background: 'var(--ledger-control-bg)', border: '1px solid var(--surface-border)', padding: '3px 8px', borderRadius: '6px', color: 'var(--text-main)', fontFamily: 'monospace' }}>
                날짜 &nbsp;|&nbsp; 내용 &nbsp;|&nbsp; 금액 &nbsp;|&nbsp; 대분류 &nbsp;|&nbsp; 소분류 &nbsp;|&nbsp; 지출 방법 &nbsp;|&nbsp; 태그 &nbsp;|&nbsp; 메모
              </code>
            </div>

            {/* Target Month Fallback Picker */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ color: 'var(--ledger-info)', fontWeight: 600, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Calendar size={13} />
                날짜 누락 시 기본 월:
              </label>
              <input
                type="month"
                value={targetMonth}
                onChange={(e) => setTargetMonth(e.target.value)}
                style={{
                  background: 'var(--surface-color)',
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  borderRadius: '6px',
                  color: 'var(--text-main)',
                  padding: '3px 8px',
                  fontSize: '0.75rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Paste Textarea */}
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileSpreadsheet size={14} color="#60a5fa" />
                복사한 데이터 붙여넣기 (Ctrl + V / ⌘ + V)
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setRawText(SAMPLE_DATA)}
                  style={{
                    background: 'var(--ledger-control-bg)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: '6px',
                    color: 'var(--ledger-info)',
                    padding: '3px 8px',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                  }}
                >
                  예시 데이터 채우기
                </button>
                <button
                  type="button"
                  onClick={downloadSampleCsv}
                  style={{ background: 'var(--ledger-control-bg)', border: '1px solid var(--surface-border)', borderRadius: '6px', color: 'var(--text-main)', padding: '3px 8px', fontSize: '0.72rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <Download size={13}/> 샘플 CSV 다운로드
                </button>
                {rawText && (
                  <button
                    type="button"
                    onClick={() => setRawText('')}
                    style={{
                      background: 'var(--ledger-control-bg)',
                      border: '1px solid var(--surface-border)',
                      borderRadius: '6px',
                      color: 'var(--text-muted)',
                      padding: '3px 8px',
                      fontSize: '0.72rem',
                      cursor: 'pointer',
                    }}
                  >
                    내용 비우기
                  </button>
                )}
              </div>
            </div>

            <textarea
              rows={4}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={`여기에 테이블 데이터를 붙여넣으세요...\n예시:\n2026-09-15\t스타벅스 강남점\t5,500\t식비\t외식\t우리카드\t#카페\t친구랑 커피\nnull\t넷플릭스 정기결제\t17,000\t생활용품\t구독\t토스뱅크\t#구독\t월정액`}
              style={{
                width: '100%',
                background: 'var(--surface-color)',
                border: '1.5px solid rgba(59, 130, 246, 0.35)',
                borderRadius: '10px',
                padding: '10px 12px',
                color: 'var(--text-main)',
                fontSize: '0.8rem',
                fontFamily: 'monospace',
                lineHeight: 1.5,
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Analysis Summary Bar */}
          {parseResult.totalCount > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'var(--ledger-subtle)',
                border: '1px solid var(--surface-border)',
                fontSize: '0.78rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                  📊 총 {parseResult.totalCount}건 분석됨:
                </span>
                <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                  ✓ 등록 가능 {parseResult.validCount}건
                </span>
                {parseResult.duplicateCount > 0 && (
                  <span
                    style={{
                      background: 'rgba(245, 158, 11, 0.15)',
                      color: 'var(--warning)',
                      padding: '1px 8px',
                      borderRadius: '4px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    ⚠️ 중복 제외 {parseResult.duplicateCount}건
                  </span>
                )}
                {parseResult.invalidCount > 0 && (
                  <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
                    ⚠ 오류 {parseResult.invalidCount}건
                  </span>
                )}
                {fallbackCount > 0 && (
                  <span
                    style={{
                      background: 'rgba(56, 189, 248, 0.15)',
                      color: 'var(--ledger-info)',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      fontSize: '0.72rem',
                    }}
                  >
                    📅 날짜 없음 {fallbackCount}건 ({targetMonth}-01로 적용)
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', fontWeight: 700 }}>
                {parseResult.totalExpense > 0 && (
                  <span style={{ color: 'var(--expense-color, #3b82f6)' }}>
                    지출: ₩{parseResult.totalExpense.toLocaleString()}
                  </span>
                )}
                {parseResult.totalIncome > 0 && (
                  <span data-sensitive-income="true" style={{ color: 'var(--income-color, #ef4444)' }}>
                    수입: +₩{parseResult.totalIncome.toLocaleString()}
                  </span>
                )}
                {parseResult.totalSavings > 0 && (
                  <span style={{ color: '#10b981' }}>
                    저축: 🌱₩{parseResult.totalSavings.toLocaleString()}
                  </span>
                )}
                {parseResult.totalTransfer > 0 && (
                  <span style={{ color: '#06b6d4' }}>
                    이체/카드값: 🔄₩{parseResult.totalTransfer.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Feedback messages */}
          {errorMsg && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: 'var(--danger)',
              }}
            >
              <AlertCircle size={15} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: 'var(--success)',
              }}
            >
              <CheckCircle2 size={15} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Table Preview */}
          {parseResult.rows.length > 0 && (
            <div
              style={{
                border: '1px solid var(--surface-border)',
                borderRadius: '10px',
                overflow: 'hidden',
                maxHeight: '320px',
                overflowY: 'auto',
              }}
            >
              <table className="ledger-table" style={{ width: '100%' }}>
                <thead>
                  <tr style={{ background: 'var(--ledger-control-bg)', color: 'var(--text-muted)', textAlign: 'left' }}>
                    <th className="ledger-cell ledger-cell--center" style={{ width: '36px' }}>
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        style={{ background: 'none', border: 'none', color: 'var(--ledger-info)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
                      >
                        {selectedIndices.size === parseResult.validCount && parseResult.validCount > 0 ? (
                          <CheckSquare size={15} />
                        ) : (
                          <Square size={15} />
                        )}
                      </button>
                    </th>
                    <th className="ledger-cell ledger-cell--start" style={{ width: '40px' }}>#</th>
                    <th className="ledger-cell ledger-cell--start" style={{ width: '110px' }}>날짜</th>
                    <th className="ledger-cell ledger-cell--start">내용</th>
                    <th className="ledger-cell ledger-cell--end" style={{ width: '100px' }}>금액</th>
                    <th className="ledger-cell ledger-cell--start" style={{ width: '90px' }}>대분류</th>
                    <th className="ledger-cell ledger-cell--start" style={{ width: '90px' }}>소분류</th>
                    <th className="ledger-cell ledger-cell--start" style={{ width: '100px' }}>지출 방법</th>
                    <th className="ledger-cell ledger-cell--start">태그 / 메모</th>
                    <th className="ledger-cell ledger-cell--center" style={{ width: '40px' }}>삭제</th>
                  </tr>
                </thead>
                <tbody>
                  {parseResult.rows.map((row) => {
                    const isSelected = selectedIndices.has(row.index);
                    return (
                      <tr
                        key={`bulk-row-${row.index}`}
                        style={{
                          borderTop: '1px solid var(--surface-border)',
                          background: row.isDuplicate
                            ? 'rgba(245, 158, 11, 0.07)'
                            : isSelected
                            ? 'rgba(59, 130, 246, 0.08)'
                            : row.isValid
                            ? 'transparent'
                            : 'rgba(239, 68, 68, 0.06)',
                          color: row.isDuplicate
                            ? 'var(--warning)'
                            : row.isValid
                            ? "var(--text-main)"
                            : 'var(--danger)',
                        }}
                      >
                        <td className="ledger-cell ledger-cell--center">
                          {row.isValid && !row.isDuplicate && (
                            <button
                              type="button"
                              onClick={() => toggleSelectRow(row.index)}
                              style={{ background: 'none', border: 'none', color: isSelected ? "var(--ledger-info)" : 'var(--text-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
                            >
                              {isSelected ? <CheckSquare size={15} /> : <Square size={15} />}
                            </button>
                          )}
                          {row.isDuplicate && (
                            <span
                              title={row.duplicateReason}
                              style={{ color: 'var(--warning)', fontSize: "12px", fontWeight: 700, cursor: 'not-allowed' }}
                            >
                              ✕
                            </span>
                          )}
                        </td>
                        <td className="ledger-cell ledger-cell--start" style={{ color: 'var(--text-muted)' }}>
                          {row.index}
                        </td>
                        <td className="ledger-cell ledger-cell--start">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>{row.dateStr}</span>
                            {row.isMonthFallback && (
                              <span
                                title="원본 날짜가 null/비어있어 해당 월 1일로 대체됨"
                                style={{
                                  fontSize: "12px",
                                  background: 'rgba(56, 189, 248, 0.2)',
                                  color: 'var(--ledger-info)',
                                  padding: '1px 4px',
                                  borderRadius: '3px',
                                }}
                              >
                                월대체
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="ledger-cell ledger-cell--start">
                          <div style={{ fontWeight: 600 }}>{row.content || '(내용 없음)'}</div>
                          {row.isDuplicate && (
                            <div
                              title={row.duplicateReason}
                              style={{
                                fontSize: "12px",
                                color: 'var(--warning)',
                                fontWeight: 500,
                                marginTop: '2px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                              }}
                            >
                              <span>⚠️ 중복 제외</span>
                              {row.duplicateReason && (
                                <span style={{ color: 'rgba(251, 191, 36, 0.8)', fontWeight: 400 }}>
                                  ({row.duplicateReason})
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td data-sensitive-income={row.type === 'DEPOSIT' ? 'true' : undefined} className="ledger-cell ledger-cell--end"
                          style={{
                            fontWeight: 700,
                            color:
                              row.type === 'DEPOSIT'
                                ? 'var(--income-color, #ef4444)'
                                : row.mainCategory === '저축' || row.mainCategory === '투자/자산증식'
                                ? '#10b981'
                                : row.mainCategory === '이체/송금'
                                ? '#06b6d4'
                                : "var(--expense-color, #3b82f6)",
                          }}
                        >
                          {row.type === 'DEPOSIT' ? '+' : '-'}₩{row.amount.toLocaleString()}
                        </td>
                        <td className="ledger-cell ledger-cell--start">
                          <span
                            style={{
                              color:
                                row.type === 'DEPOSIT'
                                  ? 'var(--income-color, #ef4444)'
                                  : row.mainCategory === '저축' || row.mainCategory === '투자/자산증식'
                                  ? '#10b981'
                                  : row.mainCategory === '이체/송금'
                                  ? '#06b6d4'
                                  : 'var(--warning)',
                              fontWeight: 600,
                            }}
                          >
                            {row.type === 'DEPOSIT' && '💰 '}
                            {row.mainCategory === '저축' && '🌱 '}
                            {row.mainCategory === '이체/송금' && '🔄 '}
                            {row.mainCategory || '-'}
                          </span>
                        </td>
                        <td className="ledger-cell ledger-cell--start">
                          <span style={{ color: 'var(--ledger-accent)' }}>
                            {row.subCategory || '-'}
                          </span>
                        </td>
                        <td className="ledger-cell ledger-cell--start">
                          <span style={{ color: 'var(--ledger-info)' }}>
                            {row.paymentMethod || '-'}
                          </span>
                        </td>
                        <td className="ledger-cell ledger-cell--start" style={{ color: 'var(--text-muted)' }}>
                          {row.tag && <span style={{ color: 'var(--ledger-info)', marginRight: '4px' }}>{row.tag}</span>}
                          {row.memo && <span>{row.memo}</span>}
                          {!row.tag && !row.memo && '-'}
                        </td>
                        <td className="ledger-cell ledger-cell--center">
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(row.index)}
                            title="이 행 제외"
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--surface-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--ledger-subtle)',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            선택된 항목: <b style={{ color: 'var(--ledger-info)' }}>{selectedIndices.size}건</b> / 등록 가능 {parseResult.validCount}건
            {parseResult.duplicateCount > 0 && (
              <span style={{ marginLeft: '8px', color: 'var(--warning)' }}>
                (중복 {parseResult.duplicateCount}건 제외됨)
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '6px 14px' }}
            >
              닫기
            </button>
            <button
              type="button"
              disabled={submitting || selectedIndices.size === 0}
              onClick={handleSubmit}
              className="btn btn-primary"
              style={{
                fontSize: '0.8rem',
                padding: '6px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: selectedIndices.size > 0 ? 1 : 0.5,
              }}
            >
              <UploadCloud size={15} />
              {submitting ? '일괄 등록 중...' : `선택한 ${selectedIndices.size}건 일괄 등록`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
