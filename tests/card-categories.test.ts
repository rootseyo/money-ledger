import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  DEFAULT_HOUSEHOLD_CATEGORIES,
  resolveCategoryInfo,
} from '../src/lib/household-categories';
import { getCategoryInfo } from '../src/lib/card-service';

test('DEFAULT_EXPENSE_CATEGORIES contains expense categories specified by user', () => {
  assert.equal(DEFAULT_EXPENSE_CATEGORIES.length, 23);

  const expectedExpenseNames = [
    '주거비',
    '식비',
    '생활용품',
    '교통비',
    '차량비',
    '통신비',
    '교육비',
    '예체능비',
    '입시/특별교육비',
    '의료/건강',
    '사회보험',
    '민간보험',
    '의류/미용',
    '문화/여가',
    '여행비',
    '경조사/선물',
    '반려동물',
    '구독서비스',
    '세금',
    '사업 관련 지출',
    '비정기지출',
    '용돈',
    '기타',
  ];

  const actualNames = DEFAULT_EXPENSE_CATEGORIES.map((c) => c.name);
  assert.deepEqual(actualNames, expectedExpenseNames);

  // 세부 소분류 매칭 검증
  const housing = DEFAULT_EXPENSE_CATEGORIES.find((c) => c.name === '주거비');
  assert.deepEqual(housing?.subcategories, ['관리비', '월세/대출이자', '전기', '가스', '수도']);

  const food = DEFAULT_EXPENSE_CATEGORIES.find((c) => c.name === '식비');
  assert.deepEqual(food?.subcategories, ['장보기', '외식', '배달', '카페/간식']);

  const artsSports = DEFAULT_EXPENSE_CATEGORIES.find((c) => c.name === '예체능비');
  assert.deepEqual(artsSports?.subcategories, ['피아노', '바이올린', '수영', '레슨', '콩쿠르']);

  const examPrep = DEFAULT_EXPENSE_CATEGORIES.find((c) => c.name === '입시/특별교육비');
  assert.deepEqual(examPrep?.subcategories, ['예중 준비', '특별레슨', '원서비', '시험비', '출장비']);

  const socialInsurance = DEFAULT_EXPENSE_CATEGORIES.find((c) => c.name === '사회보험');
  assert.deepEqual(socialInsurance?.subcategories, ['국민건강보험', '장기요양보험', '국민연금']);

  const privateInsurance = DEFAULT_EXPENSE_CATEGORIES.find((c) => c.name === '민간보험');
  assert.deepEqual(privateInsurance?.subcategories, ['실손', '생명보험', '어린이보험 등']);

  const allowance = DEFAULT_EXPENSE_CATEGORIES.find((c) => c.name === '용돈');
  assert.deepEqual(allowance?.subcategories, ['자녀용돈', '배우자용돈', '개인용돈', '부모님용돈']);
});

test('DEFAULT_INCOME_CATEGORIES contains income categories specified by user', () => {
  assert.equal(DEFAULT_INCOME_CATEGORIES.length, 9);

  const expectedIncomeNames = [
    '근로소득',
    '사업소득',
    '금융소득',
    '투자수익',
    '공적급여/지원금',
    '환급금',
    '중고판매/기타수입',
    '가족간 수입',
    '수입',
  ];

  const actualNames = DEFAULT_INCOME_CATEGORIES.map((c) => c.name);
  assert.deepEqual(actualNames, expectedIncomeNames);

  const salary = DEFAULT_INCOME_CATEGORIES.find((c) => c.name === '근로소득');
  assert.ok(salary?.subcategories.includes('급여'));

  const bizIncome = DEFAULT_INCOME_CATEGORIES.find((c) => c.name === '사업소득');
  assert.deepEqual(bizIncome?.subcategories, ['용역매출', '프리랜서 수입', '기타 사업매출']);

  const investment = DEFAULT_INCOME_CATEGORIES.find((c) => c.name === '투자수익');
  assert.deepEqual(investment?.subcategories, ['주식 매도차익', '펀드 수익', '가상자산 수익']);

  const refund = DEFAULT_INCOME_CATEGORIES.find((c) => c.name === '환급금');
  assert.deepEqual(refund?.subcategories, ['세금환급', '보험금', '카드 캐시백']);
});

test('DEFAULT_HOUSEHOLD_CATEGORIES combines expense, income, savings, and transfer categories', () => {
  assert.equal(DEFAULT_HOUSEHOLD_CATEGORIES.length, 35);
});

test('resolveCategoryInfo resolves properly by ID, Name, Subcategory, and legacy codes', () => {
  // 1. By ID
  const housingById = resolveCategoryInfo('HOUSING');
  assert.equal(housingById.name, '주거비');
  assert.equal(housingById.emoji, '🏠');

  const salaryById = resolveCategoryInfo('SALARY');
  assert.equal(salaryById.name, '근로소득');
  assert.equal(salaryById.type, 'INCOME');

  // 2. By Name
  const foodByName = resolveCategoryInfo('식비');
  assert.equal(foodByName.id, 'FOOD');
  assert.equal(foodByName.emoji, '🍚');

  // 3. By Subcategory
  const maintenance = resolveCategoryInfo('관리비');
  assert.equal(maintenance.name, '주거비');
  assert.equal(maintenance.label, '관리비');

  const bonus = resolveCategoryInfo('상여');
  assert.equal(bonus.name, '근로소득');
  assert.equal(bonus.label, '상여');

  // 4. Legacy codes
  const legacyInsurance = resolveCategoryInfo('INSURANCE');
  assert.equal(legacyInsurance.name, '보험');

  // 5. Savings & Investment
  const savings = resolveCategoryInfo('저축');
  assert.equal(savings.name, '저축');
  assert.equal(savings.type, 'SAVINGS');
});

test('card-service getCategoryInfo integrates smoothly with household categories and legacy codes', () => {
  const legacyInfo = getCategoryInfo('INSURANCE');
  assert.equal(legacyInfo.label, '보험');
  assert.equal(legacyInfo.emoji, '🛡️');

  const newHousingInfo = getCategoryInfo('HOUSING');
  assert.equal(newHousingInfo.label, '주거비');
  assert.equal(newHousingInfo.emoji, '🏠');

  const newIncomeInfo = getCategoryInfo('SALARY');
  assert.equal(newIncomeInfo.label, '근로소득');
  assert.equal(newIncomeInfo.emoji, '💰');

  const savingsInfo = getCategoryInfo('SAVINGS');
  assert.equal(savingsInfo.label, '저축/투자');
  assert.equal(savingsInfo.emoji, '🌱');
});
