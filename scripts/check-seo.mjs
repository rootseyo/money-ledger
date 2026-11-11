import assert from 'node:assert/strict';

const origin = process.argv[2] || 'http://localhost:4013';
const canonical = process.env.APP_CANONICAL_URL || (process.env.NEXT_PUBLIC_APP_URL ? new URL('/', process.env.NEXT_PUBLIC_APP_URL).href : 'http://localhost:3000/');
const verification = process.env.NAVER_SITE_VERIFICATION || '4ba3b9cba230a1ba680b2e0a00273e48630e3f51';
const read = (path, headers = {}) => fetch(new URL(path, origin), { redirect: 'manual', headers });
function tags(html, tag) {
  return [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'g'))].map(match => Object.fromEntries([...match[0].matchAll(/([\w:-]+)="([^"]*)"/g)].map(item => [item[1], item[2]])));
}
for (const agent of [undefined, 'Yeti/1.1 (+http://naver.me/spd)']) {
  const response = await read('/', agent ? { 'user-agent': agent } : {});
  assert.equal(response.status, 200, 'public home must return 200 without a redirect');
  assert.equal(response.headers.get('location'), null);
  assert.match(response.headers.get('cache-control') || '', /no-store/);
  const html = await response.text();
  const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1] || '';
  assert.equal(tags(head, 'meta').find(tag => tag.name === 'naver-site-verification')?.content, verification, 'Naver ownership tag must be in the initial HTML head');
  const meta = tags(html, 'meta');
  const links = tags(html, 'link');
  assert.equal(meta.find(tag => tag.name === 'naver-site-verification')?.content, verification);
  assert.equal(new URL(links.find(tag => tag.rel === 'canonical')?.href || 'about:blank').href, canonical);
  assert.equal(links.some(tag => tag.hreflang === 'en-US'), false);
  assert.equal(new URL(meta.find(tag => tag.property === 'og:url')?.content || 'about:blank').href, canonical);
  assert.equal(meta.find(tag => tag.property === 'og:image')?.content, `${canonical}og-ledger.png`);
  assert.equal(meta.find(tag => tag.name === 'twitter:card')?.content, 'summary_large_image');
  assert.doesNotMatch(meta.find(tag => tag.name === 'robots')?.content || '', /noindex/);
  const json = [...html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)].map(match => JSON.parse(match[1]));
  assert.ok(json.some(data => data['@graph']?.some(node => node['@type'] === 'WebSite' && node.url === canonical)));
  assert.ok(html.includes('구성원별 모임 회비') && html.includes('사진·PDF 영수증'));
}
if (process.argv.includes('--local-auth')) {
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname), 'synthetic session is only used against a local server');
  process.loadEnvFile('.env');
  const { default: jwt } = await import('jsonwebtoken');
  const token = jwt.sign({ id: 'seo-smoke-only', name: 'SEO test', email: 'seo@example.test', role: 'MEMBER' }, process.env.JWT_SECRET, { expiresIn: '30s' });
  const response = await read('/', { authorization: `Bearer ${token}` });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-middleware-rewrite'), null);
  assert.match(response.headers.get('x-robots-tag') || '', /noindex/);
  assert.match(response.headers.get('cache-control') || '', /private/);
  assert.match(response.headers.get('cache-control') || '', /no-store/);
}
const signup = await read('/signup');
assert.equal(signup.status, 200);
assert.match(tags(await signup.text(), 'meta').find(tag => tag.name === 'robots')?.content || '', /noindex/);
const workspace = await read('/workspace');
assert.equal(workspace.status, 307);
assert.match(workspace.headers.get('x-robots-tag') || '', /noindex/);
const image = await read('/og-ledger.png');
assert.equal(image.status, 200);
assert.match(image.headers.get('content-type') || '', /image\/png/);
const bytes = Buffer.from(await image.arrayBuffer());
assert.equal(bytes.readUInt32BE(16), 1200);
assert.equal(bytes.readUInt32BE(20), 630);
const map = await read('/sitemap.xml');
assert.equal(map.status, 200);
const xml = await map.text();
assert.ok(xml.includes(`<loc>${canonical}</loc>`));
assert.equal(/\/(login|signup|workspace)<\/loc>/.test(xml), false);
const robots = await read('/robots.txt');
assert.equal(robots.status, 200);
assert.ok((await robots.text()).includes(`${canonical}sitemap.xml`));
console.log('SEO checks passed: public home + Naver crawler, verification, canonical, JSON-LD, image, sitemap and private-page exclusion.');
