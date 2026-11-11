import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTransactionsToTable, getVisualWidth, padVisual } from '../src/lib/card-service';

test('getVisualWidth calculates correct visual width for mixed Korean and ASCII', () => {
  assert.equal(getVisualWidth('우리카드'), 8); // 한글 4자 * 2 = 8
  assert.equal(getVisualWidth('Woori'), 5);    // 영문 5자 = 5
  assert.equal(getVisualWidth('12,000원'), 8); // 숫자+쉼표 6 + 한글 2 = 8
});

test('padVisual pads text according to visual width', () => {
  const padded = padVisual('토스', 8);
  assert.equal(getVisualWidth(padded), 8);
  assert.equal(padded, '토스    ');

  const paddedRight = padVisual('5,000원', 10, true);
  assert.equal(getVisualWidth(paddedRight), 10);
  assert.equal(paddedRight, '   5,000원');
});

test('formatTransactionsToTable outputs formatted table and CSV-compatible pipes', () => {
  const sampleTransactions = [
    {
      notifiedAt: new Date('2026-09-29T11:30:00+09:00'),
      sourceApp: 'WOORI_CARD',
      type: 'PAYMENT',
      amount: 15000,
      merchant: '스타벅스 강남점',
      balance: null,
      cardOrAccount: '우리카드(0123)',
    },
    {
      notifiedAt: new Date('2026-09-29T12:00:00+09:00'),
      sourceApp: 'TOSS_BANK',
      type: 'WITHDRAWAL',
      amount: 50000,
      merchant: '홍길동',
      balance: 450000,
      cardOrAccount: '토스뱅크',
    },
    {
      notifiedAt: new Date('2026-09-29T13:15:00+09:00'),
      sourceApp: 'KAKAO_PAY',
      type: 'PAYMENT',
      amount: 8900,
      merchant: '배달의민족',
      balance: null,
      cardOrAccount: '카카오페이머니',
    },
  ];

  const table = formatTransactionsToTable(sampleTransactions);
  assert.ok(table.includes('| 일시'));
  assert.ok(table.includes('우리카드'));
  assert.ok(table.includes('토스뱅크'));
  assert.ok(table.includes('카카오페이'));
  assert.ok(table.includes('15,000'));
  assert.ok(table.includes('450,000'));
  assert.ok(table.includes('스타벅스 강남점'));

  // 각 행이 | 로 시작하고 | 로 끝나는지 확인
  const lines = table.split('\n');
  assert.ok(lines.length >= 5);
  for (const line of lines) {
    assert.ok(line.startsWith('|'));
    assert.ok(line.endsWith('|'));
  }
});

test('autoDetectCategory detects HEALTH for 국민건강 and LIVING for 국민연금', async () => {
  const { autoDetectCategory } = await import('../src/lib/card-service');
  assert.equal(autoDetectCategory('2609국민건강', '우리WON뱅킹 입출금알림', '[출금] 2609국민건강 22,170원'), 'HEALTH');
  assert.equal(autoDetectCategory('2609국민연금', '우리WON뱅킹 입출금알림', '[출금] 2609국민연금 94,770원'), 'LIVING');
});

test('autoDetectCategory detects INSURANCE for insurance companies and policies', async () => {
  const { autoDetectCategory, getCategoryInfo } = await import('../src/lib/card-service');
  assert.equal(autoDetectCategory('삼성생명보험', '카드결제', '삼성생명보험 54,000원 결제'), 'INSURANCE');
  assert.equal(autoDetectCategory('현대해상화재보험', '우리WON뱅킹', '[출금] 현대해상 32,000원'), 'INSURANCE');
  assert.equal(autoDetectCategory('DB손해보험', '알림', 'DB손해보험 실손의료비 21,000원'), 'INSURANCE');
  assert.equal(getCategoryInfo('INSURANCE').label, '보험');
  assert.equal(getCategoryInfo('INSURANCE').emoji, '🛡️');
});

test('classifyTransactionRole correctly distinguishes income, consumption, savings, and transfer', async () => {
  const { classifyTransactionRole } = await import('../src/lib/card-service');

  // 1. Income (수입은 늘리고)
  assert.equal(classifyTransactionRole({ type: 'DEPOSIT', title: '급여' }), 'INCOME');
  assert.equal(classifyTransactionRole({ type: 'DEPOSIT', title: '예금 만기 이자' }), 'INCOME');

  // 2. Savings & Asset Building (저축은 꾸준하게)
  assert.equal(classifyTransactionRole({ type: 'WITHDRAWAL', title: '[세연] 주택 청약', category: '저축' }), 'SAVINGS');
  assert.equal(classifyTransactionRole({ type: 'WITHDRAWAL', title: '우리 신규 예금 2.8', category: '저축' }), 'SAVINGS');
  assert.equal(classifyTransactionRole({ type: 'WITHDRAWAL', title: '실업급여 세이프박스 저금' }), 'SAVINGS');
  assert.equal(classifyTransactionRole({ type: 'PAYMENT', title: '주식 매수', category: '투자' }), 'SAVINGS');

  // 3. Transfers (이체/카드대금)
  assert.equal(classifyTransactionRole({ type: 'WITHDRAWAL', title: '우리카드 결제일', category: '이체/송금' }), 'TRANSFER');

  // 4. Pure Consumption Spending (지출은 통제하고)
  assert.equal(classifyTransactionRole({ type: 'PAYMENT', title: '솥내음 마곡점', category: '식비' }), 'CONSUMPTION');
  assert.equal(classifyTransactionRole({ type: 'PAYMENT', title: '쿠팡 로켓배송', category: '생활용품' }), 'CONSUMPTION');
});


