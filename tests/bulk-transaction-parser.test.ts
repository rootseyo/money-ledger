import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseBulkTransactions,
  normalizeBulkDate,
  isHeaderRow,
  splitColumns,
} from '../src/lib/bulk-transaction-parser';

test('isHeaderRow detects table headers correctly', () => {
  const headerCols = ['날짜', '내용', '금액', '대분류', '소분류', '지출 방법', '태그', '메모'];
  assert.equal(isHeaderRow(headerCols), true);

  const dataCols = ['2026-09-15', '스타벅스', '5500', '식비', '외식', '우리카드', '#커피', '친구랑'];
  assert.equal(isHeaderRow(dataCols), false);
});

test('normalizeBulkDate falls back to defaultMonth-01 when date is null/empty/dash', () => {
  const defaultMonth = '2026-09';

  assert.deepEqual(normalizeBulkDate('', defaultMonth), { dateStr: '2026-09-01', isMonthFallback: true });
  assert.deepEqual(normalizeBulkDate('null', defaultMonth), { dateStr: '2026-09-01', isMonthFallback: true });
  assert.deepEqual(normalizeBulkDate('NULL', defaultMonth), { dateStr: '2026-09-01', isMonthFallback: true });
  assert.deepEqual(normalizeBulkDate('-', defaultMonth), { dateStr: '2026-09-01', isMonthFallback: true });
  assert.deepEqual(normalizeBulkDate('없음', defaultMonth), { dateStr: '2026-09-01', isMonthFallback: true });

  // Explicit dates
  assert.deepEqual(normalizeBulkDate('2026-09-25', defaultMonth), { dateStr: '2026-09-25', isMonthFallback: false });
  assert.deepEqual(normalizeBulkDate('2026.09.25', defaultMonth), { dateStr: '2026-09-25', isMonthFallback: false });
  assert.deepEqual(normalizeBulkDate('15일', defaultMonth), { dateStr: '2026-09-15', isMonthFallback: false });
  assert.deepEqual(normalizeBulkDate('9.18', defaultMonth), { dateStr: '2026-09-18', isMonthFallback: false });
});

test('parseBulkTransactions parses tab-separated web table data including null date fallback', () => {
  const rawInput = [
    '날짜\t내용\t금액\t대분류\t소분류\t지출 방법\t태그\t메모',
    '2026-09-15\t스타벅스 강남점\t5,500원\t식비\t외식\t우리카드\t#카페\t아이스 아메리카노',
    'null\t월 정기 구독\t14,900\t생활용품\t잡화\t토스뱅크\t#구독\t넷플릭스',
    '-\t급여 입금\t+3,500,000\t근로소득\t급여\t우리WON\t#월급\t9월분 급여',
  ].join('\n');

  const result = parseBulkTransactions(rawInput, '2026-09');

  assert.equal(result.totalCount, 3);
  assert.equal(result.validCount, 3);
  assert.equal(result.invalidCount, 0);

  // Row 1: Normal date
  const row1 = result.rows[0];
  assert.equal(row1.dateStr, '2026-09-15');
  assert.equal(row1.isMonthFallback, false);
  assert.equal(row1.content, '스타벅스 강남점');
  assert.equal(row1.amount, 5500);
  assert.equal(row1.mainCategory, '식비');
  assert.equal(row1.subCategory, '외식');
  assert.equal(row1.type, 'PAYMENT');
  assert.equal(row1.sourceApp, 'WOORI_CARD');
  assert.equal(row1.formattedContent, '[가계부 대량 등록] [외식] 스타벅스 강남점 (태그: #카페) - 아이스 아메리카노');

  // Row 2: Date is null -> fallback to 2026-09-01
  const row2 = result.rows[1];
  assert.equal(row2.dateStr, '2026-09-01');
  assert.equal(row2.isMonthFallback, true);
  assert.equal(row2.amount, 14900);
  assert.equal(row2.mainCategory, '생활용품');
  assert.equal(row2.sourceApp, 'TOSS_BANK');

  // Row 3: Income (근로소득, +3,500,000, date '-')
  const row3 = result.rows[2];
  assert.equal(row3.dateStr, '2026-09-01');
  assert.equal(row3.isMonthFallback, true);
  assert.equal(row3.amount, 3500000);
  assert.equal(row3.type, 'DEPOSIT');
  assert.equal(row3.sourceApp, 'WOORI_WON');

  assert.equal(result.totalExpense, 5500 + 14900);
  assert.equal(result.totalIncome, 3500000);
});

test('isTransactionDuplicate correctly identifies duplicates and ignores non-duplicates', async () => {
  const { isTransactionDuplicate, formatToKSTDate, normalizeMerchant } = await import(
    '../src/lib/bulk-transaction-parser'
  );

  // Exact match
  assert.equal(
    isTransactionDuplicate(
      { dateStr: '2026-09-15', amount: 5500, type: 'PAYMENT', content: '스타벅스 강남점' },
      { dateStr: '2026-09-15', amount: 5500, type: 'PAYMENT', merchant: '스타벅스 강남점' }
    ),
    true
  );

  // Normalized match with bracketed title/tags and slight merchant difference
  assert.equal(
    isTransactionDuplicate(
      { dateStr: '2026-09-15', amount: 5500, type: 'PAYMENT', content: '스타벅스' },
      {
        notifiedAt: '2026-09-15T03:00:00Z', // 12:00 KST
        amount: 5500,
        type: 'PAYMENT',
        merchant: '스타벅스 강남점',
      }
    ),
    true
  );

  // Different date -> NOT duplicate
  assert.equal(
    isTransactionDuplicate(
      { dateStr: '2026-09-15', amount: 5500, type: 'PAYMENT', content: '스타벅스' },
      { dateStr: '2026-09-16', amount: 5500, type: 'PAYMENT', merchant: '스타벅스' }
    ),
    false
  );

  // Different amount -> NOT duplicate
  assert.equal(
    isTransactionDuplicate(
      { dateStr: '2026-09-15', amount: 5500, type: 'PAYMENT', content: '스타벅스' },
      { dateStr: '2026-09-15', amount: 6000, type: 'PAYMENT', merchant: '스타벅스' }
    ),
    false
  );

  // Income vs Expense (different direction) -> NOT duplicate
  assert.equal(
    isTransactionDuplicate(
      { dateStr: '2026-09-15', amount: 50000, type: 'PAYMENT', content: '환급' },
      { dateStr: '2026-09-15', amount: 50000, type: 'DEPOSIT', content: '환급' }
    ),
    false
  );

  // Different merchant on same day and same amount -> NOT duplicate
  assert.equal(
    isTransactionDuplicate(
      { dateStr: '2026-09-15', amount: 5000, type: 'PAYMENT', content: '이디야 커피' },
      { dateStr: '2026-09-15', amount: 5000, type: 'PAYMENT', merchant: '파리바게뜨' }
    ),
    false
  );
});

test('parseBulkTransactions flags intra-batch duplicates and database duplicates', () => {
  const existingDb = [
    {
      id: 'existing-1',
      notifiedAt: '2026-09-15T04:00:00Z', // 2026-09-15 in KST
      amount: 5500,
      type: 'PAYMENT',
      merchant: '스타벅스 강남점',
      title: '[가계부] 스타벅스 강남점',
      content: '[가계부 대량 등록] 스타벅스 강남점',
    },
  ];

  const rawInput = [
    '날짜\t내용\t금액\t대분류\t소분류\t지출 방법\t태그\t메모',
    // Row 1: Matches existingDb -> duplicate!
    '2026-09-15\t스타벅스 강남점\t5,500원\t식비\t외식\t우리카드\t#카페\t기존 중복',
    // Row 2: New unique row
    '2026-09-16\t교보문고\t25,000\t문화/여가\t도서\t토스뱅크\t#책\t개발 서적',
    // Row 3: Duplicate of Row 2 in same batch -> intra-batch duplicate!
    '2026-09-16\t교보문고\t25,000\t문화/여가\t도서\t토스뱅크\t#책\t중복행',
  ].join('\n');

  const result = parseBulkTransactions(rawInput, '2026-09', undefined, existingDb);

  assert.equal(result.totalCount, 3);
  assert.equal(result.validCount, 1); // Only Row 2 is valid & non-duplicate
  assert.equal(result.duplicateCount, 2); // Row 1 & Row 3 are duplicates
  assert.equal(result.invalidCount, 0);

  // Row 1: duplicate against existing DB
  assert.equal(result.rows[0].isDuplicate, true);
  assert.ok(result.rows[0].duplicateReason?.includes('기존 거래와 중복'));

  // Row 2: valid non-duplicate
  assert.equal(result.rows[1].isDuplicate, false);
  assert.equal(result.rows[1].duplicateReason, undefined);

  // Row 3: duplicate against Row 2
  assert.equal(result.rows[2].isDuplicate, true);
  assert.ok(result.rows[2].duplicateReason?.includes('입력 목록 내 중복'));

  // Total expense only sums non-duplicate valid rows
  assert.equal(result.totalExpense, 25000);
});

test('parseBulkTransactions automatically fills missing date column when dates are omitted or blank', () => {
  // 1. Row without date column entirely (starts with content, then amount)
  const noDateInput = [
    '스타벅스 강남점\t5,500원\t식비\t외식\t우리카드\t#커피\t아메리카노',
    '이마트 역삼점\t48,900\t식비\t장보기\t토스뱅크\t#생필품\t장보기',
  ].join('\n');

  const result1 = parseBulkTransactions(noDateInput, '2026-09');
  assert.equal(result1.totalCount, 2);
  assert.equal(result1.validCount, 2);

  // Row 1: Content and amount should NOT be shifted
  assert.equal(result1.rows[0].dateStr, '2026-09-01');
  assert.equal(result1.rows[0].isMonthFallback, true);
  assert.equal(result1.rows[0].content, '스타벅스 강남점');
  assert.equal(result1.rows[0].amount, 5500);
  assert.equal(result1.rows[0].mainCategory, '식비');
  assert.equal(result1.rows[0].subCategory, '외식');
  assert.equal(result1.rows[0].paymentMethod, '우리카드');

  // 2. Row with leading tab (empty date column)
  const leadingTabInput = '\t투썸플레이스\t6,200\t식비\t디저트\t카카오페이';
  const result2 = parseBulkTransactions(leadingTabInput, '2026-09');
  assert.equal(result2.rows[0].dateStr, '2026-09-01');
  assert.equal(result2.rows[0].isMonthFallback, true);
  assert.equal(result2.rows[0].content, '투썸플레이스');
  assert.equal(result2.rows[0].amount, 6200);

  // 3. Header without date column
  const headerWithoutDate = [
    '내용\t금액\t대분류\t소분류\t지출 방법',
    '맥도날드 역삼점\t9,800\t식비\t패스트푸드\t우리카드',
  ].join('\n');
  const result3 = parseBulkTransactions(headerWithoutDate, '2026-09');
  assert.equal(result3.totalCount, 1);
  assert.equal(result3.rows[0].content, '맥도날드 역삼점');
  assert.equal(result3.rows[0].amount, 9800);
  assert.equal(result3.rows[0].mainCategory, '식비');
});

test('parseBulkTransactions accurately resolves income (DEPOSIT), savings (WITHDRAWAL), card bills (TRANSFER), and allowance (EXPENSE)', () => {
  const sampleData = [
    '9/28\t세요 8월 급여 (고용보험료 빼고)\t11,000,000\t수입\t월급\t현금',
    '9/23\t사랑 아동수당\t100,000\t수입\t부수입\t현금',
    '9/8\t세요 카뱅 1000 예금 만기 이자\t211,500\t수입\t부수입\t현금',
    '9/20\t엄마이모가 용돈\t200,000\t수입\t부수입\t현금',
    '9/23\t세금 환급\t280,000\t수입\t부수입\t현금',
    '9/1\t[세연] 주택 청약\t50,000\t저축\t적금\t현금',
    '9/26\t카뱅 세이프박스 300 비상금\t3,000,000\t저축\t세이프박스\t현금',
    '9/1\t[주혜] 우리카드 결제일 (매월1일)\t77,220\t카드값\t고요\t신용카드',
    '9/28\t[세연] 우리카드 결제일 (27일)\t613,250\t카드값\t세요\t세요신용카드',
    '9/6\t사랑 용돈 2주치\t6,000\t용돈\t하랑사랑\t현금',
    '9/1\t[사랑] 바이올린 레슨비 (5회)\t100,000\t교육비\t사랑\t현금',
  ].join('\n');

  const result = parseBulkTransactions(sampleData, '2026-09');

  assert.equal(result.totalCount, 11);
  assert.equal(result.validCount, 11);

  // 1. 수입 rows -> type: 'DEPOSIT'
  const salaryRow = result.rows[0];
  assert.equal(salaryRow.amount, 11000000);
  assert.equal(salaryRow.type, 'DEPOSIT');
  assert.equal(salaryRow.mainCategory, '근로소득');

  const allowanceIncomeRow = result.rows[1];
  assert.equal(allowanceIncomeRow.amount, 100000);
  assert.equal(allowanceIncomeRow.type, 'DEPOSIT');
  assert.equal(allowanceIncomeRow.mainCategory, '공적급여/지원금');

  const interestRow = result.rows[2];
  assert.equal(interestRow.amount, 211500);
  assert.equal(interestRow.type, 'DEPOSIT');
  assert.equal(interestRow.mainCategory, '금융소득');

  const giftRow = result.rows[3];
  assert.equal(giftRow.amount, 200000);
  assert.equal(giftRow.type, 'DEPOSIT');
  assert.equal(giftRow.mainCategory, '가족간 수입');

  const refundRow = result.rows[4];
  assert.equal(refundRow.amount, 280000);
  assert.equal(refundRow.type, 'DEPOSIT');
  assert.equal(refundRow.mainCategory, '환급금');

  // 2. 저축 rows -> type: 'WITHDRAWAL', mainCategory: '저축'
  const savingsRow1 = result.rows[5];
  assert.equal(savingsRow1.amount, 50000);
  assert.equal(savingsRow1.type, 'WITHDRAWAL');
  assert.equal(savingsRow1.mainCategory, '저축');

  const savingsRow2 = result.rows[6];
  assert.equal(savingsRow2.amount, 3000000);
  assert.equal(savingsRow2.type, 'WITHDRAWAL');
  assert.equal(savingsRow2.mainCategory, '저축');

  // 3. 카드값 rows -> type: 'WITHDRAWAL', mainCategory: '이체/송금'
  const cardBillRow1 = result.rows[7];
  assert.equal(cardBillRow1.amount, 77220);
  assert.equal(cardBillRow1.type, 'WITHDRAWAL');
  assert.equal(cardBillRow1.mainCategory, '이체/송금');

  // 4. 용돈 row -> type: 'PAYMENT', mainCategory: '용돈' (지출)
  const allowanceExpenseRow = result.rows[9];
  assert.equal(allowanceExpenseRow.amount, 6000);
  assert.equal(allowanceExpenseRow.type, 'PAYMENT');
  assert.equal(allowanceExpenseRow.mainCategory, '용돈');

  // 5. 교육비 row -> type: 'PAYMENT'
  const eduRow = result.rows[10];
  assert.equal(eduRow.amount, 100000);
  assert.equal(eduRow.type, 'PAYMENT');

  // 6. Totals check
  // Income: 11,000,000 + 100,000 + 211,500 + 200,000 + 280,000 = 11,791,500
  assert.equal(result.totalIncome, 11791500);
  // Savings: 50,000 + 3,000,000 = 3,050,000
  assert.equal(result.totalSavings, 3050000);
  // Transfer (card bills): 77,220 + 613,250 = 690,470
  assert.equal(result.totalTransfer, 690470);
  // Living Expenses: 6,000 (용돈) + 100,000 (바이올린) = 106,000
  assert.equal(result.totalExpense, 106000);
});

