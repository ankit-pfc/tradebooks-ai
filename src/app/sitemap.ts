import { MetadataRoute } from 'next'
import { glossaryTerms } from '@/data/glossary'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tradebooks.ai'
  const now = new Date()
  
  const glossaryUrls: MetadataRoute.Sitemap = glossaryTerms.map((term) => ({
    url: `${base}/glossary/${term.slug}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.6,
  }))
  
  return [
    { url: base, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/glossary`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/guides/zerodha-tally-accounting`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/guides/f-and-o-tax-audit-india`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/guides/tax-loss-harvesting-demat-accounts`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    ...glossaryUrls,
  ]
}
