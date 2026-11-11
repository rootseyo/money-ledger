import type { Metadata } from 'next';
import { publicPageMetadata, SITE_URL, SITE_NAME, SITE_TITLE, SITE_DESCRIPTION } from '@/lib/seo';
import './globals.css';
import './card-history.css';
import DemoNotice from '@/components/DemoNotice';
import ScreenSecurity from '@/components/ScreenSecurity';

const appAuthor = process.env.NEXT_PUBLIC_APP_AUTHOR || 'Money Ledger';

export const metadata: Metadata = {
  ...publicPageMetadata(SITE_TITLE, SITE_DESCRIPTION, '/'),
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} | ${SITE_TITLE}`, template: `%s | ${SITE_NAME}` },
  applicationName: SITE_NAME,
  keywords: ['가계부', '공유 가계부', '가족 가계부', '모임 가계부', '동호회 회비 관리', '수입 지출 관리', '영수증 첨부', '고정비 관리', '회사 가계부', '세금계산서'],
  authors: [{ name: appAuthor, url: SITE_URL }],
  creator: appAuthor,
  publisher: appAuthor,
  formatDetection: { telephone: false, date: false, address: false, email: false },
  verification: process.env.NAVER_SITE_VERIFICATION
    ? { other: { 'naver-site-verification': process.env.NAVER_SITE_VERIFICATION } }
    : undefined,
  icons: { icon: [{ url: '/icon.svg', type: 'image/svg+xml' }, { url: '/icon.png', type: 'image/png', sizes: '32x32' }], shortcut: '/icon.png', apple: '/apple-icon.png' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" data-theme="light">
      <body>
        <ScreenSecurity><DemoNotice />{children}</ScreenSecurity>
      </body>
    </html>
  );
}
