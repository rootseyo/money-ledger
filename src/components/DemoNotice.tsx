 'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
export default function DemoNotice() {
  const pathname = usePathname();
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    if (pathname !== '/') return;
    let active = true;
    void fetch('/api/auth/me').then(r => r.json()).then(data => { if (active) setDemo(data.user?.role === 'DEMO'); }).catch(() => {});
    return () => { active = false; };
  }, [pathname]);
  if (!demo || pathname !== '/') return null;
  return <aside style={{ padding: '12px 20px', background: '#172554', color: '#bfdbfe', textAlign: 'center', fontSize: 13 }}>데모 체험 중 · 샘플 데이터는 자유롭게 수정할 수 있습니다. <Link href="/signup" style={{ color: '#fff', fontWeight: 700 }}>내 가계부 만들기 →</Link></aside>;
}
