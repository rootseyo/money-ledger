import test from 'node:test';
import assert from 'node:assert/strict';
import { projectWealth, monthAfter } from '../src/lib/wealth-goal';
import { getKoreanHolidays } from '../src/lib/korean-holidays';

test('10억 목표: 음수 순자산, 목표 달성, 감소 속도와 올림 계산', () => {
  assert.equal(projectWealth(100_000_000, 3_000_000).months, 300);
  assert.equal(projectWealth(-10_000_000, 3_000_000).months, 337);
  assert.equal(projectWealth(1_100_000_000, 0).months, 0);
  assert.equal(projectWealth(100_000_000, -1).months, null);
  assert.equal(projectWealth(-10_000_000, 0).progress, 0);
  assert.equal(projectWealth(1_100_000_000, 0).progress, 100);
  assert.equal(monthAfter('2026-01', -3), '2025-10');
  assert.equal(monthAfter('2026-10', 5), '2027-03');
  // 최근 6개월 오프셋 (-6 ~ -1): 2026-10 기준 9월, 8월, 7월, 6월, 5월, 4월
  const recent6Months = [-6, -5, -4, -3, -2, -1].map(offset => monthAfter('2026-10', offset));
  assert.deepEqual(recent6Months, ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
});
test('2026 한국 공휴일과 대체공휴일', () => {
  const holidays = getKoreanHolidays(2026);
  for (const [date, name] of Object.entries({
    '2026-02-16': '설날', '2026-02-17': '설날', '2026-02-18': '설날',
    '2026-03-02': '삼일절 대체공휴일', '2026-05-01': '노동절',
    '2026-05-24': '부처님오신날', '2026-05-25': '부처님오신날 대체공휴일',
    '2026-06-03': '전국동시지방선거일', '2026-07-17': '제헌절',
    '2026-08-17': '광복절 대체공휴일', '2026-09-24': '추석',
    '2026-09-25': '추석', '2026-09-26': '추석', '2026-10-05': '개천절 대체공휴일',
  })) assert.equal(holidays[date], name, date);
  assert.equal(holidays['2026-06-08'], undefined);
  assert.equal(holidays['2026-09-28'], undefined);
});
test('공휴일 중복, 임시공휴일, 연도별 법 개정', () => {
  const holidays = getKoreanHolidays(2025);
  assert.equal(holidays['2025-01-27'], '임시공휴일');
  assert.match(holidays['2025-05-05'], /어린이날.*부처님오신날/);
  assert.match(holidays['2025-05-06'], /어린이날 대체공휴일.*부처님오신날 대체공휴일/);
  assert.equal(holidays['2025-05-07'], undefined);
  assert.equal(holidays['2025-07-17'], undefined);
  assert.equal(getKoreanHolidays(2027)['2027-07-19'], '제헌절 대체공휴일');
});
