# LLM Crawler User Agents

When optimizing `robots.txt` for AI/LLM visibility, explicitly add `Allow: /` rules for the following user agents. If a company wants to block AI scraping, these same agents should be added with `Disallow: /`.

## Major AI & LLM Crawlers

| User-Agent | Company / LLM | Purpose |
|---|---|---|
| `GPTBot` | OpenAI | Crawling for training data and inference context for ChatGPT and future models. |
| `ChatGPT-User` | OpenAI | Used by ChatGPT when a user explicitly asks it to browse a specific URL via the web browsing plugin. |
| `OAI-SearchBot` | OpenAI | Used by SearchGPT / OpenAI search features. |
| `ClaudeBot` | Anthropic | Crawling for Claude model training. |
| `anthropic-ai` | Anthropic | General Anthropic crawler. |
| `PerplexityBot` | Perplexity | Used to fetch pages to summarize answers for Perplexity.ai search queries. |
| `GoogleOther` | Google | Generic Google crawler not tied to traditional Search indexing; often used for R&D and Gemini training/inference. |
| `Google-Extended` | Google | Opt-out control mechanism for Google's AI products (Bard, Gemini). Blocks use for training without blocking Google Search indexation. |
| `cohere-ai` | Cohere | Crawling for Cohere's enterprise AI models. |
| `CCBot` | Common Crawl | Massive open web scraper. Its data is the foundation for datasets like C4, which train almost all open-source models (LLaMA, Falcon, etc). |

## `robots.txt` Example Snippet (Pro-AI)

```text
User-agent: GPTBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: GoogleOther
Allow: /
User-agent: anthropic-ai
Allow: /
User-agent: cohere-ai
Allow: /
User-agent: CCBot
Allow: /
```
