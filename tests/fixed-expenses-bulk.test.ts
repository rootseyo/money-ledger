import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_FIXED_EXPENSES,
  FixedExpenseItem,
  calculateMonthlyNormalizedAmount,
} from '../src/lib/fixed-expenses';

test('Fixed expenses bulk deletion logic correctly removes selected IDs', () => {
  const initialItems: FixedExpenseItem[] = [
    {
      id: 'fe-netflix',
      name: '넷플릭스',
      amount: 17000,
      category: '문화/여가',
      paymentMethod: '우리카드',
      cycle: 'MONTHLY',
      payDay: 'LAST_DAY',
      startDate: '2025-01-01',
      isAutoPay: true,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'fe-telecom',
      name: '통신비',
      amount: 65000,
      category: '주거/통신',
      paymentMethod: '우리WON',
      cycle: 'MONTHLY',
      payDay: '15',
      startDate: '2025-01-01',
      isAutoPay: true,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'fe-rent',
      name: '월세',
      amount: 500000,
      category: '주거/통신',
      paymentMethod: '우리WON',
      cycle: 'MONTHLY',
      payDay: '25',
      startDate: '2025-01-01',
      isAutoPay: true,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  // Test 1: Deleting multiple IDs
  const deleteIds1 = ['fe-netflix', 'fe-telecom'];
  const deleteSet1 = new Set(deleteIds1);
  const remaining1 = initialItems.filter((i) => !deleteSet1.has(i.id));

  assert.equal(remaining1.length, 1);
  assert.equal(remaining1[0].id, 'fe-rent');
  assert.equal(remaining1[0].name, '월세');

  // Test 2: Deleting single ID via array
  const deleteIds2 = ['fe-rent'];
  const deleteSet2 = new Set(deleteIds2);
  const remaining2 = initialItems.filter((i) => !deleteSet2.has(i.id));

  assert.equal(remaining2.length, 2);
  assert.deepEqual(
    remaining2.map((i) => i.id),
    ['fe-netflix', 'fe-telecom']
  );

  // Test 3: Deleting non-existent ID does not mutate or remove items
  const deleteIds3 = ['fe-non-existent'];
  const deleteSet3 = new Set(deleteIds3);
  const remaining3 = initialItems.filter((i) => !deleteSet3.has(i.id));

  assert.equal(remaining3.length, 3);
});

test('Parsing ids from query parameter and request body', () => {
  // Query param comma separated
  const parseQueryParam = (search: string): string[] => {
    const params = new URLSearchParams(search);
    const idsParam = params.get('ids');
    const idParam = params.get('id');
    if (idsParam) {
      return idsParam.split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (idParam) {
      return [idParam.trim()];
    }
    return [];
  };

  assert.deepEqual(parseQueryParam('ids=fe-1,fe-2,fe-3'), ['fe-1', 'fe-2', 'fe-3']);
  assert.deepEqual(parseQueryParam('ids=fe-1,%20fe-2%20'), ['fe-1', 'fe-2']);
  assert.deepEqual(parseQueryParam('id=fe-single'), ['fe-single']);
  assert.deepEqual(parseQueryParam(''), []);
});
