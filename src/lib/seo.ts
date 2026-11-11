import type { Metadata } from 'next';

export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
export const SITE_NAME = process.env.NEXT_PUBLIC_APP_NAME || '함께 쓰는 가계부';
export const SITE_TITLE = '개인·가족 가계부부터 모임 회비, 회사 회계까지';
export const SITE_DESCRIPTION = '개인 생활비와 가족 가계부, 동호회 회비, 회사 세금계산서와 세금 예측까지 한곳에서 스마트하게 관리하세요.';
export const SHARE_IMAGE = { url: '/og-ledger.png', width: 1200, height: 630, type: 'image/png', alt: `${SITE_NAME} — 개인 생활비, 가족 가계부, 모임 회비, 회사 회계` };

export function publicPageMetadata(title: string, description: string, path: string, index = true): Metadata {
  return {
    title, description,
    alternates: { canonical: path },
    robots: { index, follow: true, googleBot: { index, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
    openGraph: { type: 'website', locale: 'ko_KR', url: path, siteName: SITE_NAME, title: `${title} | ${SITE_NAME}`, description, images: [SHARE_IMAGE] },
    twitter: { card: 'summary_large_image', title: `${title} | ${SITE_NAME}`, description, images: [SHARE_IMAGE] },
  };
}

export const PRIVATE_PAGE_METADATA: Metadata = { robots: { index: false, follow: false, noarchive: true }, alternates: { canonical: null } };

export const serviceStructuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', '@id': `${SITE_URL}/#publisher`, name: process.env.NEXT_PUBLIC_APP_AUTHOR || SITE_NAME, url: SITE_URL },
    { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, name: SITE_NAME, alternateName: 'Money Ledger', url: `${SITE_URL}/`, inLanguage: 'ko-KR', publisher: { '@id': `${SITE_URL}/#publisher` } },
    { '@type': 'WebPage', '@id': `${SITE_URL}/#webpage`, url: `${SITE_URL}/`, name: SITE_TITLE, description: SITE_DESCRIPTION, inLanguage: 'ko-KR', isPartOf: { '@id': `${SITE_URL}/#website` }, about: { '@id': `${SITE_URL}/#application` } },
    {
      '@type': 'WebApplication', '@id': `${SITE_URL}/#application`, name: SITE_NAME, url: `${SITE_URL}/`, description: SITE_DESCRIPTION,
      applicationCategory: 'FinanceApplication', operatingSystem: 'Web', inLanguage: 'ko-KR', image: `${SITE_URL}${SHARE_IMAGE.url}`,
      publisher: { '@id': `${SITE_URL}/#publisher` },
      featureList: ['개인·가족 수입·지출 기록', '구성원별 모임 회비 입금과 납부 상태', '공동 지출 관리', '거래별 사진·PDF 영수증 첨부', '고정비와 카테고리 분석', '구성원 초대와 역할별 권한', '선택형 목돈 목표', '회사 세금계산서 및 예상 세금 예측'],
    },
  ],
};

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
