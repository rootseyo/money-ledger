import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, lastModified: '2026-10-16', changeFrequency: 'monthly', priority: 1 },
    { url: `${SITE_URL}/terms`, lastModified: '2026-10-07', changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/privacy`, lastModified: '2026-10-07', changeFrequency: 'yearly', priority: 0.2 },
  ];
}
