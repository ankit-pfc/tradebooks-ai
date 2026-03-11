---
name: llm-indexing
version: 1.0.0
description: When the user wants to optimize their site for AI search engines, add llms.txt, or implement fast indexing strategies for Google/Bing through APIs. Also use when the user mentions "llms.txt", "GPTBot", "index my site for AI", "IndexNow", or "Google Indexing API".
---

# LLM Search Indexing & Fast API Indexing

You are an expert in AI Search Engine Optimization (AIO/GEO) and technical SEO infrastructure. Your goal is to make the site perfectly comprehensible to Large Language Models (ChatGPT, Perplexity, Claude, Gemini) and to set up instantaneous indexing pipelines.

## 1. LLM Discovery: `llms.txt`

The `/llms.txt` standard (proposed at [llmstxt.org](https://llmstxt.org/)) provides LLM crawlers a clean, Markdown-formatted map of the site.

### Action Plan
1. Create `/llms.txt` at the site root.
   - For static sites: create a literal `llms.txt` file in the `public` directory.
   - For Next.js/App Router: create `app/llms.txt/route.ts` returning `Content-Type: text/plain`.
2. Following the standard format:
   - Must start with an `H1` (the site name).
   - Must be followed by a `>` blockquote with a site summary.
   - Separate content categories with `H2` headers.
   - Use Markdown links: `- [Link Title](https://...)`
3. Optional: Create `/llms-full.txt` if the site is large, which contains a flattened list of all URLs for greedy contexts.

> **Note:** See `references/llms-txt-template.md` for a starting template.

## 2. Crawler Access: `robots.txt`

LLM crawlers respect `robots.txt`. By default, they might not crawl aggressively unless explicitly allowed.

### Action Plan
1. Ensure the site has a `robots.txt` or `robots.ts`.
2. Add explicit `Allow: /` rules for the major LLM bots.
3. Explicitly add `/llms.txt` to the `sitemap:` directives at the bottom of the file to aid discovery.

> **Note:** See `references/llm-crawlers.md` for the list of bots to allow.

## 3. Fast Indexing Infrastructure

For immediate inclusion in traditional search engines (which also feeds LLMs), rely on APIs rather than passive sitemap crawling.

### Action Plan: IndexNow (Bing, Yandex, DuckDuckGo)
1. Generate an IndexNow key (min 8 chars, alphanumeric).
2. Host it at the root of the site (e.g., `https://yoursite.com/yourkey.txt`). The file must contain exactly the key string.
3. Submit the key via `https://api.indexnow.org/indexnow?url=url-changed&key=your-key`.

### Action Plan: Google Indexing API
1. Requires a Google Cloud Platform (GCP) project.
2. Enable "Web Search Indexing API".
3. Create a Service Account and download the JSON key.
4. Add the Service Account email as an Owner in Google Search Console.
5. Setup a script or use an open-source tool like `uditgoenka/indexer` to handle rotating keys and 200 URLs/day limits constraint.

## 4. Submitting to LLM Directories

Once the `llms.txt` is live, the site should be submitted to community directories to signal LLM readiness.

- [llmstxt.site](https://llmstxt.site/)
- [directory.llmstxt.cloud](https://directory.llmstxt.cloud/)

## Task-Specific Questions

1. Is this a static site or a dynamic framework (Next.js, Astro, etc.)?
2. Do you have a `sitemap.xml` we can use to generate the `llms.txt`?
3. Do you want to set up Google Indexing API service accounts now, or just implement the codebase changes?
