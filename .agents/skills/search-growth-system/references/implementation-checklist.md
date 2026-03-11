# Search Growth System — Implementation Checklist

Use this as the master checklist to move from fragmented SEO work to a unified execution system.

## 1) Technical SEO Foundation

- [ ] `robots.txt` (or `robots.ts`) exists and allows key crawlers
- [ ] `sitemap.xml` exists and includes all canonical indexable routes
- [ ] Canonical tags are present and correct across key templates
- [ ] Core metadata is complete (title, description, OG, Twitter)
- [ ] Structured data exists on key page types (Article, FAQPage, BreadcrumbList, Organization, ItemList)

## 2) GEO / LLM Discoverability

- [ ] `/llms.txt` exists and follows llmstxt conventions
- [ ] `/llms-full.txt` exists for large URL surfaces
- [ ] AI crawler directives are explicitly allowed in robots rules
- [ ] Key machine-readable endpoints are available and stable

## 3) AEO Layer

- [ ] `/brand-facts` page exists and is neutral/factual
- [ ] `/.well-known/brand-facts.json` exists and validates
- [ ] 3–5 answer-hub pages exist for high-intent recommendation queries
- [ ] Answer hubs include TL;DR, chooser/comparison structure, FAQ, and citations
- [ ] Prompt-testing matrix exists for ChatGPT, Perplexity, Claude, and Gemini

## 4) pSEO System

- [ ] Template families are documented (concepts, comparisons, lexicon, etc.)
- [ ] Each family has quality scoring criteria
- [ ] Each family has a decision state: Scale / Improve / Pause
- [ ] Expansion is limited to families that show indexation and impressions

## 5) Indexing Operations

- [ ] IndexNow key verification endpoint is live
- [ ] IndexNow submit flow supports batch submissions
- [ ] Search Console inspection/request workflow is defined
- [ ] Publish-to-submission runbook is standardized

## 6) Measurement and Validation

- [ ] GSC page-cluster baseline (28d + 90d) captured
- [ ] Sitemap vs indexed reconciliation performed
- [ ] GA4 events validated in DebugView and reports
- [ ] SEO-to-conversion pathway metrics defined (e.g., organic → lead/activation)
- [ ] Monthly KPI snapshot format is established

## 7) Recurring Operations

- [ ] Weekly publishing + indexing cycle runs consistently
- [ ] Monthly refresh cycle (CTR/position opportunities) runs consistently
- [ ] Quarterly strategic reprioritization is documented
- [ ] Execution logs or validation payloads are retained
