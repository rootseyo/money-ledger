import type { Metadata } from 'next';
import AuthForm from '@/components/AuthForm';
import { publicPageMetadata, SITE_TITLE, SITE_DESCRIPTION, serviceStructuredData, serializeJsonLd } from '@/lib/seo';

export const metadata: Metadata = publicPageMetadata(SITE_TITLE, SITE_DESCRIPTION, '/');

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ kakaoError?: string | string[] }> }) {
  const query = await searchParams;
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(serviceStructuredData) }} />
    <AuthForm kakaoError={query.kakaoError !== undefined} />
  </>;
}
