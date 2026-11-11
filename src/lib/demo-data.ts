export function demoTransactions(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 3600000);
  const entries = [
    ['급여', 3500000, 'DEPOSIT', '급여'], ['월세', 600000, 'PAYMENT', 'LIVING'],
    ['장보기', 87500, 'PAYMENT', 'FOOD'], ['동네 카페', 5500, 'PAYMENT', 'CAFE'],
    ['점심 식사', 12000, 'PAYMENT', 'FOOD'], ['대중교통', 65000, 'PAYMENT', 'TRANS'],
    ['생활용품', 32000, 'PAYMENT', 'LIVING'], ['영화 관람', 15000, 'PAYMENT', 'CULTURE'],
    ['정기 적금', 500000, 'WITHDRAWAL', '저축'], ['온라인 쇼핑', 79000, 'PAYMENT', 'SHOPPING'],
    ['병원', 18000, 'PAYMENT', 'HEALTH'], ['구독 서비스', 17000, 'PAYMENT', 'CULTURE'],
  ] as const;
  return [0, 1, 2].flatMap(monthOffset => entries.map(([merchant, amount, type, category], index) => {
    const day = monthOffset === 0 ? Math.max(1, kst.getUTCDate() - index) : index * 2 + 1;
    const notifiedAt = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth() - monthOffset, day, 3));
    return { sourceApp: 'MANUAL', type, amount, merchant, category, title: merchant, content: `샘플 거래: ${merchant}`, cardOrAccount: '데모 카드', notifiedAt, isReported: true, rawData: { manual: true, demo: true } };
  }));
}
