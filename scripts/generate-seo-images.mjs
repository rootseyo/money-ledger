import sharp from 'sharp';
import { readFile, mkdir } from 'node:fs/promises';

await mkdir('public', { recursive: true });
const appDomain = process.env.APP_DOMAIN || process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, '') || 'money.example.com';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#f5f8f6"/>
<rect x="0" y="0" width="1200" height="12" fill="#197653"/>
<g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="4"><path d="M74 73h39v30H74z" stroke="#197653"/><path d="M74 73v-7h33v7M99 83h18v12H99z" stroke="#4c71ad"/></g>
<g font-family="Apple SD Gothic Neo, Noto Sans KR, sans-serif">
<text x="136" y="99" fill="#197653" font-size="30" font-weight="700">함께 쓰는 가계부</text>
<text x="72" y="251" fill="#1b2b23" font-size="68" font-weight="700">개인·가족·모임 가계부,</text>
<text x="72" y="340" fill="#197653" font-size="68" font-weight="700">함께 기록해요.</text>
<text x="76" y="414" fill="#56675f" font-size="29">생활비부터 동호회 회비와 공동 지출까지</text>
<path d="M76 472H1124" stroke="#d4e1d8" stroke-width="2"/>
<text x="76" y="528" fill="#354a3c" font-size="25">수입·지출 기록　 ·　 구성원별 회비　 ·　 영수증 첨부</text>
<text x="76" y="582" fill="#65796d" font-size="21">${appDomain}</text>
</g></svg>`;
// Raster assets are generated once and deployed as files; social crawlers do
// not depend on runtime font downloads or an authenticated image endpoint.
await sharp(Buffer.from(svg)).png().toFile('public/og-ledger.png');
const icon = await readFile('src/app/icon.svg');
await sharp(icon).resize(32, 32).png().toFile('src/app/icon.png');
await sharp(icon).resize(180, 180).png().toFile('src/app/apple-icon.png');
