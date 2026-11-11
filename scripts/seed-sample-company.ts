/**
 * 샘플 회사 회계 데이터 시드 스크립트 (오픈소스 예제용)
 * 
 * 가상의 소프트웨어 개발사 예시 데이터:
 * - 가상 거래처: (주)알파솔루션, 베타소프트웨어(주)
 * - 6개월치 매출 세금계산서 및 부가가치세/종합소득세 납부 예시
 * 
 * 실행 방법:
 *   npx tsx scripts/seed-sample-company.ts [householdId]
 */

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import fs from 'node:fs';

const SAMPLE_INVOICES = [
  { issueDate: '2026-01-31', counterparty: '(주)알파솔루션', item: '웹 서비스 개발 용역', supplyAmount: 5000000, vat: 500000, dueDate: '2026-02-28', settledAt: '2026-02-28' },
  { issueDate: '2026-02-28', counterparty: '(주)알파솔루션', item: '웹 서비스 개발 용역', supplyAmount: 5000000, vat: 500000, dueDate: '2026-03-31', settledAt: '2026-03-31' },
  { issueDate: '2026-03-31', counterparty: '베타소프트웨어(주)', item: '클라우드 인프라 구축 용역', supplyAmount: 8000000, vat: 800000, dueDate: '2026-04-30', settledAt: '2026-04-30' },
  { issueDate: '2026-04-30', counterparty: '베타소프트웨어(주)', item: '클라우드 인프라 유지보수', supplyAmount: 4000000, vat: 400000, dueDate: '2026-05-31', settledAt: '2026-05-31' },
  { issueDate: '2026-05-31', counterparty: '(주)알파솔루션', item: '모바일 앱 개발 용역', supplyAmount: 7000000, vat: 700000, dueDate: '2026-06-30', settledAt: '2026-06-30' },
  { issueDate: '2026-06-30', counterparty: '(주)알파솔루션', item: '모바일 앱 개발 용역', supplyAmount: 7000000, vat: 700000, dueDate: '2026-07-31', settledAt: null }, // 미수
];

const SAMPLE_TAX_PAYMENTS = [
  { paidAt: '2026-01-25', amount: 1500000, taxType: 'VAT', period: '2025년 2기 확정', memo: '부가가치세 확정신고 납부' },
  { paidAt: '2026-04-25', amount: 750000, taxType: 'VAT', period: '2026년 1기 예정', memo: '부가가치세 예정고지 납부' },
  { paidAt: '2026-05-31', amount: 1200000, taxType: 'INCOME', period: '2025년 귀속 종소세', memo: '종합소득세 확정신고 납부' },
];

async function main() {
  const envPath = fs.existsSync('.env') ? '.env' : '.env.local';
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env 파일이 없습니다.');
    process.exit(1);
  }

  const envText = fs.readFileSync(envPath, 'utf8');
  const match = envText.match(/DATABASE_URL=["']?([^"'\r\n]+)/);
  if (!match) {
    console.error('❌ DATABASE_URL 설정이 필요합니다.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: match[1] });

  try {
    const targetHouseholdId = process.argv[2];
    let query = "SELECT key, value FROM system_settings WHERE category = 'HOUSEHOLD' AND value LIKE '%COMPANY%'";
    if (targetHouseholdId) {
      query = `SELECT key, value FROM system_settings WHERE key = 'household:${targetHouseholdId}'`;
    }

    const res = await pool.query(query);
    if (!res.rows.length) {
      console.log('ℹ️ 회사형(COMPANY) 가계부를 찾지 못했습니다. 먼저 웹 화면에서 회사 가계부를 하나 생성해 주세요.');
      return;
    }

    const household = JSON.parse(res.rows[0].value);
    const householdId = household.id;
    const ownerId = household.ownerId;
    console.log(`📌 대상 가계부: ${household.name} (ID: ${householdId})`);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const invoices = SAMPLE_INVOICES.map(inv => ({
        id: randomUUID(),
        kind: 'SALES',
        issueDate: inv.issueDate,
        issued: true,
        counterparty: inv.counterparty,
        item: inv.item,
        supplyAmount: inv.supplyAmount,
        vat: inv.vat,
        dueDate: inv.dueDate,
        settledAt: inv.settledAt,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      const taxPayments = SAMPLE_TAX_PAYMENTS.map(pay => ({
        id: randomUUID(),
        paidAt: pay.paidAt,
        taxType: pay.taxType,
        amount: pay.amount,
        period: pay.period,
        memo: pay.memo,
        taxOffice: '국세청 홈택스',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      const settingKey = `${householdId}:company_finance`;
      const financeData = {
        invoices,
        taxPayments,
        cashBalance: 15000000,
        openDate: '2025-01-01',
      };

      await client.query(
        `INSERT INTO system_settings (key, "userId", value, description, category, "updatedAt")
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (key) DO UPDATE
         SET value = EXCLUDED.value, "updatedAt" = NOW()`,
        [settingKey, ownerId, JSON.stringify(financeData), '회사 회계 샘플 데이터', 'HOUSEHOLD']
      );

      await client.query('COMMIT');
      console.log(`✅ 샘플 세금계산서 ${invoices.length}건, 세금 납부 내역 ${taxPayments.length}건이 등록되었습니다.`);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
