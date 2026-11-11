'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
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
  Repeat,
  DollarSign,
  Copy,
} from 'lucide-react';
import {
  parseBulkFixedExpenses,
  BulkParsedFixedExpenseRow,
} from '@/lib/bulk-fixed-expenses-parser';
import {
  HouseholdCategory,
  DEFAULT_HOUSEHOLD_CATEGORIES,
} from '@/lib/household-categories';
import {
  FixedExpenseItem,
  formatPayDayLabel,
  formatCycleLabel,
} from '@/lib/fixed-expenses';

interface BulkFixedExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories?: HouseholdCategory[];
  existingItems?: FixedExpenseItem[];
  onSuccess?: () => void;
}

const SAMPLE_DATA = `항목명\t금액\t주기\t결제일\t카테고리\t결제수단\t메모
넷플릭스 정기결제\t17,000\t매월\t말일\t문화/여가\t우리카드\t프리미엄 4K 멤버십
휴대폰 통신비\t65,000\t매월\t15일\t주거/통신\t우리WON\tKT 5G 무제한
주택 월세\t500,000\t매월\t25일\t주거/통신\t우리WON\t월세 자동송금
쿠팡 와우 멤버십\t4,990\t매월\t7일\t생활용품\t우리카드\t로켓와우
아파트 관리비\t220,000\t매월\t28일\t주거/통신\t자동이체\t관리비 납부
헬스장 연회비\t600,000\t매년\t1일\t의료/건강\t국민카드\t연간 회원권`;

export default function BulkFixedExpenseModal({
  isOpen,
  onClose,
  categories = DEFAULT_HOUSEHOLD_CATEGORIES,
  existingItems = [],
  onSuccess,
}: BulkFixedExpenseModalProps) {
  const [rawText, setRawText] = useState('');
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copiedSample, setCopiedSample] = useState(false);

  // Parse whenever rawText or existingItems changes
  const parseResult = useMemo(() => {
    return parseBulkFixedExpenses(rawText, categories, existingItems);
  }, [rawText, categories, existingItems]);

  // Sync selection: by default, select all valid, non-duplicate rows
  useEffect(() => {
    const validNonDuplicate = new Set(
      parseResult.rows.filter((r) => r.isValid && !r.isDuplicate).map((r) => r.index)
    );
    setSelectedIndices(validNonDuplicate);
  }, [parseResult.rows]);

  if (!isOpen) return null;

  const toggleSelectAll = () => {
    const validRows = parseResult.rows.filter((r) => r.isValid && !r.isDuplicate);
    if (selectedIndices.size === validRows.length && validRows.length > 0) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(validRows.map((r) => r.index)));
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
    const lines = rawText.split(/\r?\n/);
    let rowIdx = 0;
    const newLines = lines.filter((line, i) => {
      if (i === 0 && line.includes('항목') && line.includes('금액')) {
        return true;
      }
      rowIdx++;
      return rowIdx !== index;
    });
    setRawText(newLines.join('\n'));
  };

  const handleCopySample = () => {
    setRawText(SAMPLE_DATA);
    setCopiedSample(true);
    setTimeout(() => setCopiedSample(false), 2000);
  };

  const handleSubmit = async () => {
    const selectedRows = parseResult.rows.filter(
      (r) => selectedIndices.has(r.index) && r.isValid && !r.isDuplicate
    );

    if (selectedRows.length === 0) {
      if (parseResult.duplicateCount > 0 && parseResult.validCount === 0) {
        setErrorMsg('모든 고정비용이 이미 등록되어 있거나 중복되어 등록할 수 없습니다.');
      } else {
        setErrorMsg('등록할 유효한 고정비용 항목을 1건 이상 선택해주세요.');
      }
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payloadItems = selectedRows.map((r) => ({
        name: r.name,
        amount: r.amount,
        cycle: r.cycle,
        payDay: r.payDay,
        category: r.category,
        subCategory: r.subCategory,
        paymentMethod: r.paymentMethod,
        startDate: r.startDate,
        endDate: r.endDate,
        isAutoPay: r.isAutoPay,
        memo: r.memo,
        merchantKeyword: r.merchantKeyword,
      }));

      const res = await fetch('/api/card-transactions/fixed-expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payloadItems }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '고정비용 일괄 등록 중 오류가 발생했습니다.');
      }

      setSuccessMsg(data.message || `${selectedRows.length}건 고정비용 등록 완료!`);
      setRawText('');
      onSuccess?.();

      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : '등록 실패');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCount = selectedIndices.size;
  const selectedMonthlyTotal = parseResult.rows
    .filter((r) => selectedIndices.has(r.index) && r.isValid)
    .reduce((sum, r) => {
      let monthly = r.amount;
      if (r.cycle === 'YEARLY') monthly = Math.round(r.amount / 12);
      else if (r.cycle === 'WEEKLY') monthly = Math.round((r.amount * 52) / 12);
      else if (r.cycle === 'DAILY') monthly = Math.round(r.amount * 30.4);
      return sum + monthly;
    }, 0);

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
          border: '1.5px solid rgba(16, 185, 129, 0.4)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)',
          background: 'linear-gradient(180deg, rgba(17, 24, 39, 0.98) 0%, rgba(11, 15, 25, 0.99) 100%)',
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
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <UploadCloud size={20} color="#34d399" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                고정비용 대량 복붙 등록 (Bulk Import)
              </h3>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                엑셀, 구글 스프레드시트, 노션, 메모에서 복사한 고정비용 목록을 한 번에 붙여넣어 일괄 등록합니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '6px', borderRadius: '50%', color: 'var(--text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {/* Notifications */}
          {errorMsg && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #ef4444',
                color: 'var(--danger)',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid #10b981',
                color: 'var(--success)',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Paste Input Area */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--text-main)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <FileSpreadsheet size={15} color="#34d399" />
                표 또는 텍스트 붙여넣기 (탭 / 쉼표 / 공백 구분 지원)
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleCopySample}
                  className="btn btn-secondary"
                  style={{
                    fontSize: '0.74rem',
                    padding: '4px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: copiedSample ? 'rgba(16, 185, 129, 0.2)' : 'var(--ledger-control-bg)',
                    color: copiedSample ? "var(--success)" : 'var(--text-muted)',
                  }}
                >
                  <Copy size={12} />
                  {copiedSample ? '샘플 적용됨!' : '샘플 데이터 붙여넣기'}
                </button>
                {rawText && (
                  <button
                    type="button"
                    onClick={() => setRawText('')}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.74rem', padding: '4px 8px', color: 'var(--text-muted)' }}
                  >
                    초기화
                  </button>
                )}
              </div>
            </div>

            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={`엑셀 또는 텍스트 행을 그대로 복사해서 여기에 붙여넣으세요.\n\n[권장 열 순서 예시]\n항목명\t금액\t주기\t결제일\t카테고리\t결제수단\t메모\n넷플릭스\t17,000\t매월\t말일\t문화/여가\t우리카드\t프리미엄 4K\n주택 월세\t500,000\t매월\t25일\t주거/통신\t우리WON\t월세 자동송금\n\n* 주기 생략 시 '매월', 결제일 생략 시 '1일', 결제수단 생략 시 '우리카드'로 자동 보정됩니다.`}
              rows={5}
              style={{
                width: '100%',
                padding: '12px 14px',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid var(--ledger-control-bg)',
                borderRadius: '8px',
                fontSize: '0.8rem',
                color: 'var(--text-main)',
                fontFamily: 'monospace',
                lineHeight: 1.5,
                resize: 'vertical',
              }}
            />
          </div>

          {/* Real-time Summary Cards */}
          {parseResult.totalCount > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: '10px',
              }}
            >
              <div
                style={{
                  background: 'var(--ledger-subtle)',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--surface-border)',
                }}
              >
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>총 감지 건수</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                  {parseResult.totalCount}건
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.08)',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                }}
              >
                <div style={{ fontSize: '0.72rem', color: 'var(--success)' }}>등록 가능 (유효)</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--success)', marginTop: '2px' }}>
                  {parseResult.validCount}건
                </div>
              </div>

              {parseResult.duplicateCount > 0 && (
                <div
                  style={{
                    background: 'rgba(245, 158, 11, 0.08)',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                  }}
                >
                  <div style={{ fontSize: '0.72rem', color: 'var(--warning)' }}>중복 항목 (자동 제외)</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--warning)', marginTop: '2px' }}>
                    {parseResult.duplicateCount}건
                  </div>
                </div>
              )}

              {parseResult.invalidCount > 0 && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.08)',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                  }}
                >
                  <div style={{ fontSize: '0.72rem', color: 'var(--danger)' }}>파싱 오류</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--danger)', marginTop: '2px' }}>
                    {parseResult.invalidCount}건
                  </div>
                </div>
              )}

              <div
                style={{
                  background: 'rgba(56, 189, 248, 0.08)',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                }}
              >
                <div style={{ fontSize: '0.72rem', color: 'var(--ledger-info)' }}>선택 고정비 월 환산 합계</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--ledger-info)', marginTop: '2px' }}>
                  ₩{selectedMonthlyTotal.toLocaleString()}
                </div>
              </div>
            </div>
          )}

          {/* Parsed Preview Table */}
          {parseResult.rows.length > 0 && (
            <div
              style={{
                border: '1px solid var(--surface-border)',
                borderRadius: '8px',
                overflow: 'hidden',
                background: 'rgba(0, 0, 0, 0.2)',
              }}
            >
              <div
                style={{
                  padding: '10px 14px',
                  background: 'var(--ledger-subtle)',
                  borderBottom: '1px solid var(--surface-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.78rem',
                      padding: 0,
                    }}
                  >
                    {selectedIndices.size === parseResult.validCount && parseResult.validCount > 0 ? (
                      <CheckSquare size={16} color="#34d399" />
                    ) : (
                      <Square size={16} />
                    )}
                    <span>전체 선택 ({selectedCount}건 선택됨)</span>
                  </button>
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  미리보기에서 항목 정보를 확인 후 하단 버튼을 눌러 등록하세요.
                </div>
              </div>

              <div style={{ overflowX: 'auto', maxHeight: '340px' }}>
                <table className="ledger-table" style={{ width: '100%' }}>
                  <thead>
                    <tr style={{ background: 'var(--ledger-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                      <th className="ledger-cell ledger-cell--center" style={{ width: '36px' }}>선택</th>
                      <th className="ledger-cell ledger-cell--center" style={{ width: '60px' }}>상태</th>
                      <th className="ledger-cell ledger-cell--start">항목명</th>
                      <th className="ledger-cell ledger-cell--end">금액</th>
                      <th className="ledger-cell ledger-cell--center">반복 주기</th>
                      <th className="ledger-cell ledger-cell--center">결제일</th>
                      <th className="ledger-cell ledger-cell--start">카테고리</th>
                      <th className="ledger-cell ledger-cell--start">결제수단</th>
                      <th className="ledger-cell ledger-cell--start">메모</th>
                      <th className="ledger-cell ledger-cell--center" style={{ width: '36px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {parseResult.rows.map((row) => {
                      const isSelected = selectedIndices.has(row.index);
                      return (
                        <tr
                          key={row.index}
                          style={{
                            borderBottom: '1px solid var(--ledger-subtle)',
                            background: isSelected
                              ? 'rgba(16, 185, 129, 0.05)'
                              : row.isDuplicate
                              ? 'rgba(245, 158, 11, 0.04)'
                              : !row.isValid
                              ? 'rgba(239, 68, 68, 0.05)'
                              : 'transparent',
                          }}
                        >
                          {/* Checkbox */}
                          <td className="ledger-cell ledger-cell--center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={!row.isValid || row.isDuplicate}
                              onChange={() => toggleSelectRow(row.index)}
                              style={{ cursor: row.isValid && !row.isDuplicate ? 'pointer' : 'not-allowed' }}
                            />
                          </td>

                          {/* Status Badge */}
                          <td className="ledger-cell ledger-cell--center">
                            {row.isDuplicate ? (
                              <span
                                style={{
                                  fontSize: "12px",
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  background: 'rgba(245, 158, 11, 0.15)',
                                  color: 'var(--warning)',
                                  border: '1px solid rgba(245, 158, 11, 0.3)',
                                }}
                                title={row.duplicateReason}
                              >
                                중복
                              </span>
                            ) : row.isValid ? (
                              <span
                                style={{
                                  fontSize: "12px",
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  background: 'rgba(16, 185, 129, 0.15)',
                                  color: 'var(--success)',
                                  border: '1px solid rgba(16, 185, 129, 0.3)',
                                }}
                              >
                                정상
                              </span>
                            ) : (
                              <span
                                style={{
                                  fontSize: "12px",
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  background: 'rgba(239, 68, 68, 0.15)',
                                  color: 'var(--danger)',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                }}
                                title={row.error}
                              >
                                오류
                              </span>
                            )}
                          </td>

                          {/* Name */}
                          <td className="ledger-cell ledger-cell--start" style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                            {row.name || <span style={{ color: 'var(--danger)' }}>(이름 없음)</span>}
                          </td>

                          {/* Amount */}
                          <td className="ledger-cell ledger-cell--end"
                            style={{
    fontWeight: 700,
    color: row.amount > 0 ? 'var(--danger)' : 'var(--text-muted)'
}}
                          >
                            ₩{row.amount.toLocaleString()}
                          </td>

                          {/* Cycle */}
                          <td className="ledger-cell ledger-cell--center">
                            <span
                              style={{
                                fontSize: "12px",
                                padding: '2px 8px',
                                borderRadius: '4px',
                                background: 'rgba(56, 189, 248, 0.1)',
                                color: 'var(--ledger-info)',
                              }}
                            >
                              {formatCycleLabel(row.cycle)}
                            </span>
                          </td>

                          {/* Pay Day */}
                          <td className="ledger-cell ledger-cell--center" style={{ color: 'var(--text-main)' }}>
                            {formatPayDayLabel(row.payDay, row.cycle)}
                          </td>

                          {/* Category */}
                          <td className="ledger-cell ledger-cell--start">
                            <span
                              style={{
                                fontSize: "12px",
                                padding: '2px 8px',
                                borderRadius: '4px',
                                background: 'var(--ledger-control-bg)',
                                color: 'var(--text-main)',
                              }}
                            >
                              {row.category}
                            </span>
                          </td>

                          {/* Payment Method */}
                          <td className="ledger-cell ledger-cell--start" style={{ color: 'var(--text-muted)' }}>
                            {row.paymentMethod}
                          </td>

                          {/* Memo */}
                          <td className="ledger-cell ledger-cell--start"
                            style={{
    color: 'var(--text-muted)',
    maxWidth: '140px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
}}
                          >
                            {row.memo || '-'}
                          </td>

                          {/* Delete row */}
                          <td className="ledger-cell ledger-cell--center">
                            <button
                              type="button"
                              onClick={() => handleRemoveRow(row.index)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: '2px',
                              }}
                              title="이 행 제외"
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
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid var(--surface-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--ledger-subtle)',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {selectedCount > 0 ? (
              <span>
                선택된 <strong style={{ color: 'var(--success)' }}>{selectedCount}건</strong> 고정비용 등록 준비 완료
              </span>
            ) : (
              <span>등록할 항목을 선택해주세요</span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" disabled={submitting}>
              취소
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="btn btn-primary"
              disabled={submitting || selectedCount === 0}
              style={{
                background: selectedCount > 0 ? '#10b981' : undefined,
                borderColor: selectedCount > 0 ? '#10b981' : undefined,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {submitting ? (
                <>
                  <UploadCloud size={15} className="animate-spin" /> 등록 중...
                </>
              ) : (
                <>
                  <UploadCloud size={15} /> 선택한 {selectedCount}건 고정비용 일괄 등록
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
