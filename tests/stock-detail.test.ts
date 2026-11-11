import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { NextRequest } from 'next/server';
import { GET, OPTIONS } from '../src/app/api/stocks/[code]/route';
import { parseNaverFundamentals, STOCK_PROFILES } from '../src/lib/stock-detail';

describe('Stock detail helpers', () => {
  test('supports the Samsung Electronics stock code', () => {
    assert.deepEqual(STOCK_PROFILES['005930'], {
      code: '005930',
      name: '삼성전자',
      market: 'KOSPI',
      ticker: '005930.KS',
      newsQuery: 'Samsung Electronics',
    });
  });

  test('parses the named fundamentals without depending on table order', () => {
    const html = `
      <em id="_pbr">3.09</em>
      <em id="_dvr">0.63</em>
      <em id="_per">11.93</em>
      <em id="_cns_per">6.00</em>
    `;
    assert.deepEqual(parseNaverFundamentals(html), {
      per: 11.93,
      forwardPer: 6,
      pbr: 3.09,
      dividendYield: 0.63,
    });
  });

  test('returns null for missing or malformed fundamentals', () => {
    assert.deepEqual(parseNaverFundamentals('<em id="_per">-</em>'), {
      per: null,
      forwardPer: null,
      pbr: null,
      dividendYield: null,
    });
  });

  test('rejects unsupported stock codes before data fetching', async () => {
    const request = new NextRequest('http://localhost:4000/api/stocks/000000', {
      headers: { origin: 'https://example.com' },
    });
    const response = await GET(request, { params: Promise.resolve({ code: '000000' }) });
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://example.com');
    assert.equal((await response.json()).error, '지원하지 않는 종목입니다.');
  });

  test('handles stock API CORS preflight', async () => {
    const request = new NextRequest('http://localhost:4000/api/stocks/005930', {
      method: 'OPTIONS',
      headers: { origin: 'https://example.com' },
    });
    const response = await OPTIONS(request);
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://example.com');
  });
});
