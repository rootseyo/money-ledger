import type { Metadata } from 'next';
import AuthForm from '@/components/AuthForm';
import { publicPageMetadata } from '@/lib/seo';

export const metadata: Metadata = publicPageMetadata('회원가입', '개인·가족 가계부와 모임 회계를 시작하세요. 새 가계부를 만들거나 초대 코드로 참여할 수 있습니다.', '/signup', false);

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ kakao?: string | string[]; kakaoError?: string | string[] }> }) {
  const query = await searchParams;
  return <AuthForm signup kakaoPending={query.kakao === '1'} kakaoError={query.kakaoError !== undefined} />;
}
