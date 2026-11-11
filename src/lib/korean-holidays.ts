// 관공서의 공휴일에 관한 규정 (2026 개정 포함).
// https://www.law.go.kr/lsInfoP.do?lsiSeq=285779
const cache = new Map<number, Record<string, string>>();
const DAY = 86400000;
const key = (date: Date) => date.toISOString().slice(0, 10);
const lunar = new Intl.DateTimeFormat('en-u-ca-dangi', { month: 'numeric', day: 'numeric', timeZone: 'Asia/Seoul' });
const special: Record<string, string> = {
  '2024-04-10': '국회의원 선거일', '2024-10-01': '임시공휴일',
  '2025-01-27': '임시공휴일', '2025-06-03': '대통령 선거일',
  '2026-06-03': '전국동시지방선거일',
};
export function getKoreanHolidays(year: number): Record<string, string> {
  if (cache.has(year)) return cache.get(year)!;
  const result: Record<string, string> = {};
  const groups: { name: string; dates: Date[]; substitute: 'weekend' | 'sunday' | false }[] = [];
  function add(name: string, dates: Date[], substitute: 'weekend' | 'sunday' | false) {
    groups.push({ name, dates, substitute });
    for (const date of dates) result[key(date)] = result[key(date)] ? `${result[key(date)]} · ${name}` : name;
  }
  const fixed: [string, string, boolean][] = [
    ['01-01', '신정', false], ['03-01', '삼일절', year >= 2021],
    ['05-05', '어린이날', year >= 2014], ['06-06', '현충일', false],
    ['08-15', '광복절', year >= 2021], ['10-03', '개천절', year >= 2021],
    ['10-09', '한글날', year >= 2021], ['12-25', '성탄절', year >= 2023],
  ];
  if (year >= 2026) fixed.push(['05-01', '노동절', false], ['07-17', '제헌절', true]);
  for (const [day, name, substitute] of fixed) add(name, [new Date(`${year}-${day}T03:00:00Z`)], substitute ? 'weekend' : false);
  for (let time = Date.UTC(year, 0, 1, 3); time < Date.UTC(year + 1, 0, 1, 3); time += DAY) {
    const date = new Date(time);
    const parts = lunar.formatToParts(date);
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    if ((month === '1' && day === '1') || (month === '8' && day === '15')) {
      add(month === '1' ? '설날' : '추석', [-1, 0, 1].map(offset => new Date(time + offset * DAY)), year >= 2014 ? 'sunday' : false);
    }
    if (month === '4' && day === '8') add('부처님오신날', [date], year >= 2023 ? 'weekend' : false);
  }
  for (const [date, name] of Object.entries(special)) if (date.startsWith(`${year}-`)) result[date] = name;
  const original = { ...result };
  for (const group of groups.sort((a, b) => a.dates[0].getTime() - b.dates[0].getTime())) {
    if (!group.substitute) continue;
    const overlap = group.dates.some(date => result[key(date)].includes(' · '));
    const weekend = group.dates.some(date => date.getUTCDay() === 0 || (group.substitute === 'weekend' && date.getUTCDay() === 6));
    if (!overlap && !weekend) continue;
    let next = new Date(group.dates.at(-1)!.getTime() + DAY);
    while ([0, 6].includes(next.getUTCDay()) || original[key(next)]) next = new Date(next.getTime() + DAY);
    result[key(next)] = result[key(next)] ? `${result[key(next)]} · ${group.name} 대체공휴일` : `${group.name} 대체공휴일`;
  }
  cache.set(year, result);
  return result;
}
