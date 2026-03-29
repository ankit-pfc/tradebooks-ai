# TradeBooks AI — SEO Master Plan
> Version 1.0 · March 2026 · Zero-to-system buildout

## Executive Summary
Current State: Pre-launch shell. No robots.txt, sitemap, structured data, llms.txt, OG tags, or AEO assets. AEO score: 0/8.
Opportunity: Zerodha-to-Tally niche is underserved. First-mover advantage with quality content is achievable.
Goal: Full SEO+GEO+AEO+pSEO system in 90 days without scaling thin content.

## Audit Findings (see full plan in artifact)

### Technical SEO — All P0
- T1: No robots.txt
- T2: No sitemap.xml
- T3: No structured data (JSON-LD)
- T4: Root metadata bleeds to all pages (no per-page metadata)
- T5: No canonical tags on sub-pages
- T6: No Open Graph / Twitter Card metadata
- T7: No llms.txt (invisible to AI crawlers)
- T8: No /.well-known/brand-facts.json
- T9: Hero images are 1.9 MB PNGs (needs WebP conversion)

### AEO Score: 0/8
All eight AEO assets are missing.

## Implementation Phases

### Phase 1 (Week 1-2): Technical Foundation
- robots.ts (with AI crawler allowlist)
- sitemap.ts
- Root metadata update (OG, Twitter, metadataBase, title template)
- Per-page metadata on /pricing, /privacy, /terms
- FAQPage + SoftwareApplication JSON-LD on homepage
- llms.txt route
- .well-known/brand-facts.json route
- OG image generation
- Google Search Console + Bing Webmaster setup

### Phase 2 (Week 3-4): AEO Assets
- /brand-facts page (Wikipedia-style)
- /guides/zerodha-tally-accounting (Answer hub #1)
- Prompt test matrix (ChatGPT, Perplexity, Claude, Gemini)

### Phase 3 (Month 2): pSEO Content
- Glossary: 10 seed terms (/glossary/[term])
- Answer hubs #2 and #3
- First comparison page

### Phase 4 (Month 3): Scale & Validate
- Scale only families with GSC traction
- Persona landers
- IndexNow setup
- Quarterly reprioritization

## pSEO Templates
1. /glossary/[term] — SCALE NOW (10 seed terms)
2. /compare/[a-vs-b] — IMPROVE BEFORE SCALING
3. /for/[persona] — BUILD AFTER MONTH 2

## KPI Targets
- Month 3: 500+ impressions, 25+ clicks, <30 avg position, 10+ indexed pages
- Month 6: 5000+ impressions, 250+ clicks, <15 avg position, 30+ indexed pages
