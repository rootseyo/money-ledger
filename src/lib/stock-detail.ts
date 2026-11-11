import 'server-only';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

export interface StockProfile {
  code: string;
  name: string;
  market: string;
  ticker: string;
  newsQuery: string;
}

export interface StockFundamentals {
  per: number | null;
  forwardPer: number | null;
  pbr: number | null;
  marketCap: number | null;
  dividendYield: number | null;
  source: string;
  updatedAt: string;
}

export interface StockNewsItem {
  id: string;
  title: string;
  publisher: string;
  url: string;
  publishedAt: string;
}

export interface StockExternalData {
  fundamentals: StockFundamentals;
  news: StockNewsItem[];
}

export const STOCK_PROFILES: Record<string, StockProfile> = {
  '005930': { code: '005930', name: '삼성전자', market: 'KOSPI', ticker: '005930.KS', newsQuery: 'Samsung Electronics' },
};

interface CachedExternalData {
  data: StockExternalData;
  expiresAt: number;
}

const CACHE_TTL_MS = 30 * 60 * 1000;
const externalDataCache = new Map<string, CachedExternalData>();

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function htmlMetric(html: string, id: string): number | null {
  const match = html.match(new RegExp(`id=["']${id}["'][^>]*>\\s*([0-9.,-]+)`, 'i'));
  if (!match) return null;
  const value = Number(match[1].replaceAll(',', ''));
  return Number.isFinite(value) ? value : null;
}

export function parseNaverFundamentals(html: string) {
  return {
    per: htmlMetric(html, '_per'),
    forwardPer: htmlMetric(html, '_cns_per'),
    pbr: htmlMetric(html, '_pbr'),
    dividendYield: htmlMetric(html, '_dvr'),
  };
}

function safeNewsUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

async function fetchDomesticFundamentals(code: string) {
  const response = await fetch(`https://finance.naver.com/item/main.naver?code=${encodeURIComponent(code)}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CockStockBot/1.0)' },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Domestic fundamentals provider returned ${response.status}`);
  return parseNaverFundamentals(await response.text());
}

export async function fetchStockExternalData(profile: StockProfile): Promise<StockExternalData> {
  const cached = externalDataCache.get(profile.code);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const [fundamentalsResult, quoteResult, newsResult] = await Promise.allSettled([
    fetchDomesticFundamentals(profile.code),
    yahooFinance.quoteSummary(profile.ticker, { modules: ['summaryDetail', 'defaultKeyStatistics', 'price'] }),
    yahooFinance.search(profile.newsQuery, { quotesCount: 1, newsCount: 20, region: 'US', lang: 'en-US' }),
  ]);

  const domestic = fundamentalsResult.status === 'fulfilled' ? fundamentalsResult.value : null;
  const quote = quoteResult.status === 'fulfilled' ? quoteResult.value : null;
  const ticker = profile.ticker.toUpperCase();
  const seenNews = new Set<string>();
  const news = newsResult.status === 'fulfilled'
    ? newsResult.value.news.flatMap((item): StockNewsItem[] => {
        const url = safeNewsUrl(item.link);
        if (!url || !item.relatedTickers?.some((related) => related.toUpperCase() === ticker) || seenNews.has(url)) return [];
        seenNews.add(url);
        return [{
          id: item.uuid,
          title: item.title.trim(),
          publisher: item.publisher.trim(),
          url,
          publishedAt: item.providerPublishTime.toISOString(),
        }];
      }).slice(0, 6)
    : [];

  const yahooDividendYield = finiteNumber(quote?.summaryDetail?.dividendYield);
  const data: StockExternalData = {
    fundamentals: {
      per: domestic?.per ?? finiteNumber(quote?.summaryDetail?.trailingPE),
      forwardPer: domestic?.forwardPer ?? finiteNumber(quote?.summaryDetail?.forwardPE) ?? finiteNumber(quote?.defaultKeyStatistics?.forwardPE),
      pbr: domestic?.pbr ?? finiteNumber(quote?.defaultKeyStatistics?.priceToBook),
      marketCap: finiteNumber(quote?.price?.marketCap) ?? finiteNumber(quote?.summaryDetail?.marketCap),
      dividendYield: domestic?.dividendYield ?? (yahooDividendYield == null ? null : yahooDividendYield * 100),
      source: domestic ? 'Npay 증권 · 에프앤가이드 / Yahoo Finance' : 'Yahoo Finance',
      updatedAt: new Date().toISOString(),
    },
    news,
  };

  externalDataCache.set(profile.code, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}
