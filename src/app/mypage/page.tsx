import { Suspense } from 'react';
import { PRIVATE_PAGE_METADATA } from '@/lib/seo';
import MyPage from '@/components/MyPage';

export const metadata = { ...PRIVATE_PAGE_METADATA, title: '마이페이지' };

export default function Page() {
  return <Suspense fallback={<main style={{ padding: 32 }}>계정 정보를 불러오는 중…</main>}><MyPage /></Suspense>;
}
