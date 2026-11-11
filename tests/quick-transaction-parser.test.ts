import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseQuickTransactionInput,
  getSlotAtCursor,
  getSlotRange,
  replaceSlotValue,
  parseQuickDate,
  formatDateToYMD,
  getRelativeDateYMD,
} from '../src/lib/quick-transaction-parser';

test('parseQuickTransactionInput parses 5 comma separated items correctly', () => {
  const result = parseQuickTransactionInput('2026-09-30, 우리카드, 식비, 스타벅스, 5500');

  assert.equal(result.isValid, true);
  assert.equal(result.dateStr, '2026-09-30');
  assert.equal(result.sourceApp, 'WOORI_CARD');
  assert.equal(result.paymentName, '우리카드');
  assert.equal(result.category, '식비');
  assert.equal(result.merchant, '스타벅스');
  assert.equal(result.amount, 5500);
  assert.equal(result.type, 'PAYMENT');
  assert.equal(result.title, '[가계부] 스타벅스');
  assert.equal(result.content, '[가계부 간편 등록] 스타벅스 5,500원 결제');
});

test('parseQuickTransactionInput handles empty content (Tab skip case: , ,)', () => {
  const result = parseQuickTransactionInput('2026-09-30, 토스뱅크, 식비, , 15000');

  assert.equal(result.isValid, true);
  assert.equal(result.dateStr, '2026-09-30');
  assert.equal(result.sourceApp, 'TOSS_BANK');
  assert.equal(result.paymentName, '토스뱅크');
  assert.equal(result.category, '식비');
  assert.equal(result.merchant, null);
  assert.equal(result.amount, 15000);
  assert.equal(result.type, 'PAYMENT');
  assert.equal(result.title, '[가계부] 결제');
  assert.equal(result.content, '[가계부 간편 등록] 15,000원 결제');
});

test('parseQuickTransactionInput auto-detects category when omitted if merchant is recognized', () => {
  const result = parseQuickTransactionInput('2026-09-30, 카카오페이, , 맥도날드 강남점, 8900');

  assert.equal(result.isValid, true);
  assert.equal(result.sourceApp, 'KAKAO_PAY');
  assert.equal(result.category, '식비');
  assert.equal(result.merchant, '맥도날드 강남점');
  assert.equal(result.amount, 8900);
});

test('parseQuickTransactionInput detects deposit when amount contains + or income category is selected', () => {
  const result1 = parseQuickTransactionInput('2026-09-30, 우리WON, 근로소득, 9월 급여, +3500000');
  assert.equal(result1.isValid, true);
  assert.equal(result1.type, 'DEPOSIT');
  assert.equal(result1.amount, 3500000);
  assert.equal(result1.title, '[가계부] 9월 급여');
  assert.equal(result1.content, '[가계부 간편 등록] 9월 급여 3,500,000원 입금');

  const result2 = parseQuickTransactionInput('2026-09-30, 우리WON, , 보너스, +500000');
  assert.equal(result2.type, 'DEPOSIT');
  assert.equal(result2.amount, 500000);
});

test('parseQuickDate parses relative dates and formats properly', () => {
  const today = formatDateToYMD(new Date());
  assert.equal(parseQuickDate('오늘').dateStr, today);
  assert.equal(parseQuickDate('').dateStr, today);
  assert.equal(parseQuickDate('//').dateStr, today);

  const yesterday = getRelativeDateYMD(-1);
  assert.equal(parseQuickDate('어제').dateStr, yesterday);

  assert.equal(parseQuickDate('2026-10-15').dateStr, '2026-10-15');
  assert.equal(parseQuickDate('2026.05.20').dateStr, '2026-05-20');
});

test('parseQuickTransactionInput parses 6 comma separated items (대분류, 소분류) correctly', () => {
  const result = parseQuickTransactionInput('2026-09-30, 우리카드, 식비, 외식, 스타벅스, 5500');

  assert.equal(result.isValid, true);
  assert.equal(result.dateStr, '2026-09-30');
  assert.equal(result.sourceApp, 'WOORI_CARD');
  assert.equal(result.paymentName, '우리카드');
  assert.equal(result.mainCategory, '식비');
  assert.equal(result.subCategory, '외식');
  assert.equal(result.category, '식비');
  assert.equal(result.merchant, '스타벅스');
  assert.equal(result.amount, 5500);
  assert.equal(result.type, 'PAYMENT');
  assert.equal(result.content, '[가계부 간편 등록] [외식] 스타벅스 5,500원 결제');
});

test('getSlotAtCursor accurately maps cursor position to slot index 0..5', () => {
  const text = '2026-09-30, 우리카드, 식비, 외식, 스타벅스, 5500';
  // Before first comma
  assert.equal(getSlotAtCursor(text, 0), 0);
  assert.equal(getSlotAtCursor(text, 10), 0);

  // After first comma (우리카드)
  assert.equal(getSlotAtCursor(text, 11), 1);
  assert.equal(getSlotAtCursor(text, 15), 1);

  // After second comma (식비)
  assert.equal(getSlotAtCursor(text, 18), 2);

  // After third comma (외식)
  assert.equal(getSlotAtCursor(text, 23), 3);

  // After fourth comma (스타벅스)
  assert.equal(getSlotAtCursor(text, 28), 4);

  // After fifth comma (5500)
  assert.equal(getSlotAtCursor(text, 36), 5);
});

test('replaceSlotValue replaces slot and appends comma for next slot up to slot 5', () => {
  // 1. Setting date in empty string
  const step1 = replaceSlotValue('', 0, '2026-09-30', true);
  assert.equal(step1.newText, '2026-09-30, ');
  assert.equal(step1.newCursorPos, 12);

  // 2. Setting payment
  const step2 = replaceSlotValue(step1.newText, 1, '토스뱅크', true);
  assert.equal(step2.newText, '2026-09-30, 토스뱅크, ');
  assert.equal(step2.newCursorPos, 18);

  // 3. Setting main category
  const step3 = replaceSlotValue(step2.newText, 2, '식비', true);
  assert.equal(step3.newText, '2026-09-30, 토스뱅크, 식비, ');

  // 4. Setting sub category
  const step4 = replaceSlotValue(step3.newText, 3, '카페/음료', true);
  assert.equal(step4.newText, '2026-09-30, 토스뱅크, 식비, 카페/음료, ');

  // 5. Setting merchant
  const step5 = replaceSlotValue(step4.newText, 4, '스타벅스', true);
  assert.equal(step5.newText, '2026-09-30, 토스뱅크, 식비, 카페/음료, 스타벅스, ');

  // 6. Setting amount
  const step6 = replaceSlotValue(step5.newText, 5, '15000', false);
  assert.equal(step6.newText, '2026-09-30, 토스뱅크, 식비, 카페/음료, 스타벅스, 15000');
});
