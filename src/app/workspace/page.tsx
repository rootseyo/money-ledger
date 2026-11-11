import { Suspense } from 'react';
import { PRIVATE_PAGE_METADATA } from '@/lib/seo';

export const metadata = { ...PRIVATE_PAGE_METADATA, title: '가계부 관리' };
import WorkspaceSetup from '@/components/WorkspaceSetup';

export default function WorkspacePage() {
  return (
    <Suspense fallback={<main className="workspace-shell"><p style={{ color: '#94a3b8', textAlign: 'center', marginTop: '40px' }}>로딩 중…</p></main>}>
      <WorkspaceSetup />
    </Suspense>
  );
}
