import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { NextRequest } from 'next/server';
import { proxy } from '../src/proxy';
import { signUserToken } from '../src/lib/auth';
import { publicPageMetadata, serializeJsonLd, serviceStructuredData, SITE_URL } from '../src/lib/seo';
import sitemap from '../src/app/sitemap';
import robots from '../src/app/robots';

test('anonymous home serves the public introduction while authenticated ledger responses stay private', () => {
  const home = proxy(new NextRequest(`${SITE_URL}/?tab=ledger`));
  assert.equal(home.status, 200);
  assert.equal(home.headers.get('x-middleware-rewrite'), `${SITE_URL}/login?tab=ledger`);
  assert.equal(home.headers.get('location'), null);
  assert.match(home.headers.get('cache-control') || '', /private, no-store/);
  assert.equal(home.headers.get('x-robots-tag'), null);
  const token = signUserToken({ id: 'seo-test', name: 'Test', email: 'seo@example.test', role: 'MEMBER' });
  const request = (path: string) => new NextRequest(`${SITE_URL}${path}`, { headers: { cookie: `money_token=${token}` } });
  for (const path of ['/', '/workspace']) {
    const response = proxy(request(path));
    assert.equal(response.headers.get('x-middleware-rewrite'), null);
    assert.match(response.headers.get('x-robots-tag') || '', /noindex/);
    assert.match(response.headers.get('cache-control') || '', /private, no-store/);
  }
  const workspace = proxy(new NextRequest(`${SITE_URL}/workspace`));
  assert.equal(workspace.status, 307);
  assert.match(workspace.headers.get('x-robots-tag') || '', /noindex/);
  const invalidSession = proxy(new NextRequest(`${SITE_URL}/`, { headers: { cookie: 'money_token=invalid' } }));
  assert.equal(invalidSession.headers.get('x-middleware-rewrite'), `${SITE_URL}/login`);
});

test('search metadata uses real canonical pages and a public PNG preview', () => {
  const metadata = publicPageMetadata('가계부', '서비스 소개', '/');
  assert.deepEqual(metadata.alternates, { canonical: '/' });
  assert.equal(metadata.twitter?.card, 'summary_large_image');
  const signup = publicPageMetadata('회원가입', '가입', '/signup', false);
  assert.deepEqual(signup.robots, { index: false, follow: true, googleBot: { index: false, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } });
  assert.deepEqual(sitemap().map(row => row.url), [`${SITE_URL}/`, `${SITE_URL}/terms`, `${SITE_URL}/privacy`]);
  assert.equal(robots().sitemap, `${SITE_URL}/sitemap.xml`);
  for (const path of ['/og-ledger.png', '/icon.png', '/apple-icon.png', '/sitemap.xml', '/robots.txt']) {
    const response = proxy(new NextRequest(`${SITE_URL}${path}`));
    assert.equal(response.headers.get('location'), null);
    assert.equal(response.headers.get('x-robots-tag'), null);
  }
  assert.match(proxy(new NextRequest(`${SITE_URL}/api/health`)).headers.get('x-robots-tag') || '', /noindex/);
});

test('structured data describes the public Korean service and cannot terminate its script element', () => {
  const nodes = serviceStructuredData['@graph'];
  assert.ok(nodes.some(node => node['@type'] === 'WebSite' && node.url === `${SITE_URL}/`));
  assert.ok(nodes.some(node => node['@type'] === 'WebApplication'));
  const payload = serializeJsonLd({ name: '</script><script>alert(1)</script>' });
  assert.equal(payload.includes('<'), false);
  assert.deepEqual(JSON.parse(payload), { name: '</script><script>alert(1)</script>' });
});

test('share and app icons ship as correctly sized PNGs, independent of runtime fonts', async () => {
  for (const [path, width, height] of [['public/og-ledger.png', 1200, 630], ['src/app/icon.png', 32, 32], ['src/app/apple-icon.png', 180, 180]] as const) {
    const bytes = await readFile(path);
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
    assert.equal(bytes.readUInt32BE(16), width);
    assert.equal(bytes.readUInt32BE(20), height);
  }
});
