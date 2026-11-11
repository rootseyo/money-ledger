import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseBulkFixedExpenses,
  normalizePayDay,
  isDateEmpty,
} from '../src/lib/bulk-fixed-expenses-parser';

test('isDateEmpty detects empty or placeholder date strings', () => {
  assert.equal(isDateEmpty(''), true);
  assert.equal(isDateEmpty('   '), true);
  assert.equal(isDateEmpty('-'), true);
  assert.equal(isDateEmpty('--'), true);
  assert.equal(isDateEmpty('null'), true);
  assert.equal(isDateEmpty('NULL'), true);
  assert.equal(isDateEmpty('none'), true);
  assert.equal(isDateEmpty('없음'), true);
  assert.equal(isDateEmpty('미정'), true);
  assert.equal(isDateEmpty('미지정'), true);
  assert.equal(isDateEmpty('공란'), true);
  assert.equal(isDateEmpty('x'), true);

  assert.equal(isDateEmpty('15일'), false);
  assert.equal(isDateEmpty('2026-09-15'), false);
  assert.equal(isDateEmpty('말일'), false);
});

test('normalizePayDay extracts day correctly from full dates and handles empty dates', () => {
  // Empty or placeholder date defaults to '1'
  assert.equal(normalizePayDay(''), '1');
  assert.equal(normalizePayDay('-'), '1');
  assert.equal(normalizePayDay('없음'), '1');
  assert.equal(normalizePayDay('null'), '1');

  // Full dates: should extract day, NOT year prefix!
  assert.equal(normalizePayDay('2026-09-15'), '15');
  assert.equal(normalizePayDay('2026.09.25'), '25');
  assert.equal(normalizePayDay('2026/09/05'), '5');
  assert.equal(normalizePayDay('9/18'), '18');

  // Korean expressions
  assert.equal(normalizePayDay('15일'), '15');
  assert.equal(normalizePayDay('매달 20일'), '20');
  assert.equal(normalizePayDay('말일'), 'LAST_DAY');
  assert.equal(normalizePayDay('마지막날'), 'LAST_DAY');
});

test('Header-based parsing: date column empty in the middle does not shift subsequent columns', () => {
  // Header: 항목명 | 금액 | 주기 | 결제일 | 카테고리 | 결제수단 | 메모
  // Row 1: has payDay "말일"
  // Row 2: payDay is empty ("\t\t")
  // Row 3: payDay is "-"
  const rawInput = [
    '항목명\t금액\t주기\t결제일\t카테고리\t결제수단\t메모',
    '넷플릭스\t17,000\t매월\t말일\t문화/여가\t우리카드\t프리미엄 4K',
    '휴대폰 요금\t65,000\t매월\t\t주거/통신\t우리WON\tKT 무제한',
    '아파트 관리비\t220,000\t매월\t-\t주거/통신\t자동이체\t관리비',
  ].join('\n');

  const result = parseBulkFixedExpenses(rawInput);
  assert.equal(result.totalCount, 3);
  assert.equal(result.validCount, 3);

  // Row 1
  const row1 = result.rows[0];
  assert.equal(row1.name, '넷플릭스');
  assert.equal(row1.amount, 17000);
  assert.equal(row1.cycle, 'MONTHLY');
  assert.equal(row1.payDay, 'LAST_DAY');
  assert.equal(row1.category, '문화/여가');
  assert.equal(row1.paymentMethod, '우리카드');
  assert.equal(row1.memo, '프리미엄 4K');

  // Row 2: Empty date must NOT shift category and paymentMethod!
  const row2 = result.rows[1];
  assert.equal(row2.name, '휴대폰 요금');
  assert.equal(row2.amount, 65000);
  assert.equal(row2.cycle, 'MONTHLY');
  assert.equal(row2.payDay, '1'); // Defaulted to 1
  assert.equal(row2.category, '주거/통신'); // NOT shifted to 우리WON!
  assert.equal(row2.paymentMethod, '우리WON'); // NOT shifted to KT 무제한!
  assert.equal(row2.memo, 'KT 무제한');

  // Row 3: Dash date must NOT shift category and paymentMethod!
  const row3 = result.rows[2];
  assert.equal(row3.name, '아파트 관리비');
  assert.equal(row3.amount, 220000);
  assert.equal(row3.payDay, '1');
  assert.equal(row3.category, '주거/통신');
  assert.equal(row3.paymentMethod, '자동이체');
  assert.equal(row3.memo, '관리비');
});

test('Header-based parsing: date column at index 0 (날짜) being empty does not shift subsequent columns', () => {
  // Common bank/ledger export: 날짜 | 내용 | 금액 | 카테고리 | 결제수단 | 메모
  const rawInput = [
    '날짜\t내용\t금액\t카테고리\t결제수단\t메모',
    '2026-09-15\t스타벅스\t5,500\t식비\t우리카드\t커피',
    '\t쿠팡 와우\t4,990\t생활용품\t토스\t멤버십', // Leading tab = empty date
    '없음\t헬스장\t60,000\t의료/건강\t국민카드\t운동',
  ].join('\n');

  const result = parseBulkFixedExpenses(rawInput);
  assert.equal(result.totalCount, 3);
  assert.equal(result.validCount, 3);

  // Row 1
  const row1 = result.rows[0];
  assert.equal(row1.name, '스타벅스');
  assert.equal(row1.amount, 5500);
  assert.equal(row1.payDay, '15');
  assert.equal(row1.category, '식비');
  assert.equal(row1.paymentMethod, '우리카드');
  assert.equal(row1.memo, '커피');

  // Row 2: Leading empty tab must NOT shift content into date!
  const row2 = result.rows[1];
  assert.equal(row2.name, '쿠팡 와우');
  assert.equal(row2.amount, 4990);
  assert.equal(row2.payDay, '1');
  assert.equal(row2.category, '생활용품');
  assert.equal(row2.paymentMethod, '토스');
  assert.equal(row2.memo, '멤버십');

  // Row 3: '없음' date must NOT shift
  const row3 = result.rows[2];
  assert.equal(row3.name, '헬스장');
  assert.equal(row3.amount, 60000);
  assert.equal(row3.payDay, '1');
  assert.equal(row3.category, '의료/건강');
  assert.equal(row3.paymentMethod, '국민카드');
  assert.equal(row3.memo, '운동');
});

test('Smart mode without headers: empty date does not become name or memo', () => {
  // Row without headers: "스타벅스" | "5500" | "매월" | "" | "식비" | "우리카드" | "메모"
  const rawInput = '스타벅스\t5,500\t매월\t\t식비\t우리카드\t친구랑 커피';
  const result = parseBulkFixedExpenses(rawInput);

  assert.equal(result.totalCount, 1);
  assert.equal(result.validCount, 1);

  const row = result.rows[0];
  assert.equal(row.name, '스타벅스');
  assert.equal(row.amount, 5500);
  assert.equal(row.cycle, 'MONTHLY');
  assert.equal(row.payDay, '1');
  assert.equal(row.category, '식비');
  assert.equal(row.paymentMethod, '우리카드');
  assert.equal(row.memo, '친구랑 커피');
});
