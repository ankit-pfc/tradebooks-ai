---
description: The 7-Layer system to optimize for AI Answer Engines (ChatGPT, Perplexity, Claude, Gemini)
---

# Answer Engine Optimization (AEO) Workflow

Use this workflow when the user wants to optimize their site to be cited and recommended by AI Assistants (AEO or GEO).

## Phase 1: Answer Intent Research
1. Identify the core product/service keyword category.
2. Ask the user (or simulate) questions real customers would ask AI (e.g., "what's the best [X] for [Y]").
3. Identify current AI responses and compile an **Answer Intent Map**: List the target query, who currently wins the recommendation, and what sources the AI cites.

## Phase 2: Create the Answer Hub
1. Generate an Answer Hub page (e.g., `/guides/best-[category]-2026`).
2. Structure the page exactly as follows:
   - **TL;DR**: 60-90 words, neutral, factual, recommendation-style. Write it exactly how ChatGPT should say it. Include specs, prices, and your product as the top pick (with 2-3 competitors).
   - **Ranked List**: 5-7 products with one-sentence justifications.
   - **Comparison Table**: Specs, dosage/features, 3rd party testing, pricing.
   - **How to Choose Section**: 3-5 practical bullets.
   - **FAQ Section**: 5-8 questions pulled directly from the Answer Intent Map.
   - **Citations**: External links to 5+ authoritative sources.
   - **CTA**: Link to your product page.

## Phase 3: Create Brand-Facts Page
1. Generate a Wikipedia-style neutral facts page at `/brand-facts`.
2. Include a one-sentence TL;DR, founding year, category, price range, SKUs with exact specs, certifications, guarantees, shipping SLAs, and customer service contacts.
3. Link out to Wikidata, Crunchbase, social profiles, and press pages.

## Phase 4: Machine-Readable Data
1. Generate a JSON file at `/.well-known/brand-facts.json`.
2. Use the reference template `/.agents/skills/answer-engine-optimization/references/brand-facts-template.md` to format the JSON data. Ensures AI bots have instant access to structured product specs.

## Phase 5: Implement Specific Schema
Add schema to the codebase:
- **Answer Hub**: Implement `ItemList` schema for ranked products and `FAQPage` schema.
- **Brand-Facts**: Implement `Organization` schema.
- **Product Pages (PDPs)**: Implement `Product` schema with GTIN/MPN + brand name, `AggregateRating`, pricing, and deep product attributes. (Crucial for GPT Shopping).

## Phase 6: Earning Third-Party Citations
(Guidance to the user / manual phase)
- Pitch niche review sites with exclusive data.
- Create/update Wikidata page.
- Build comparison pages (`/compare/brand-vs-partner`) citing external sources.
- Engage on platforms like Reddit/Quora authnetically.

## Phase 7: GPT Shopping Eligibility
(Guidance to the user / manual phase)
- Ensure all identifiers (GTIN/MPN) are configured.
- Front-load titles with specs and intent.
- Ensure clean 1200px+ images on white backgrounds.
- Map review apps to SKUs (aim for 50+ reviews, 4.2+ stars).
- Maintain healthy Merchant Center feed.
