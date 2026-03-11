---
name: seo-geo-writing
description: >
  Subskill for search-optimized and LLM-indexable content writing. Covers both traditional SEO (Google, Bing rankings) and GEO/AEO (Generative Engine Optimization — getting cited by ChatGPT, Perplexity, Claude, Gemini in AI-generated responses). Invoke alongside content-writing-core and web-content-writing. This skill adds: keyword integration, topical authority architecture, E-E-A-T signals, semantic structure, FAQ and schema patterns, and LLM-specific formatting conventions. Use for: any content intended to rank in search OR be cited by AI engines. GEO and SEO are not in conflict — GEO is an extension of SEO.
version: 1.0
invoke_with: content-writing-core, web-content-writing
---

# SEO + GEO Writing — Subskill

**Inherits from:** content-writing-core, web-content-writing  
**Adds:** Keyword strategy, on-page SEO, topical authority, E-E-A-T signals, GEO/AEO optimization, schema patterns, LLM citation mechanics

---

## 1. The Unified Principle: Helpful Content Ranks and Gets Cited

The most important thing to understand about both modern SEO and GEO: optimizing for the algorithm is now identical to optimizing for the reader. Google's Helpful Content system, and the citation behavior of LLMs, both reward the same qualities:

- **Depth:** Comprehensive coverage of the actual topic
- **Specificity:** Concrete details, data, named entities, precise claims
- **Authority signals:** First-hand experience, credentials, verifiable sources
- **Structure:** Clear, navigable, well-labeled content

Keyword stuffing, thin content, and writing for robots has been punishing performance since 2022. The inverse is now true: the best content for humans is the best-ranked content. Write for the reader first. Then apply SEO/GEO formatting.

---

## 2. Traditional SEO — On-Page Mechanics

### 2.1 Keyword Strategy by Position

**Target keyword (primary):**
- Should appear in: H1 title (exact or close variant), first 100 words, at least 1 subheading, URL slug, meta title, meta description
- Density: 0.5-1.5% is a guideline, not a rule. Write naturally; the keyword will appear at the right rate if the content is about the topic.
- Never: exact-match keywords in positions where they read unnaturally

**Supporting keywords (secondary/semantic):**
- Synonyms and related terms the reader would naturally use
- These appear throughout the content — not placed, just used
- LSI (Latent Semantic Indexing) terms: the vocabulary that a truly authoritative piece on this topic would contain

**Long-tail keywords:**
- Used as subheadings (often match question format: "How does X work?", "What is the difference between X and Y?")
- Drive lower-volume but higher-conversion traffic
- FAQ sections are the natural home for long-tail question keywords

### 2.2 URL, Title, Meta Structure

**URL slug:**
- Descriptive, hyphenated, lowercase
- Contains primary keyword
- Remove stop words (the, a, an, of) for cleanliness
- Example: `/content-writing-for-seo` not `/how-to-write-content-for-seo-optimization-guide`

**Meta title (≤60 characters):**
- Primary keyword in first half if possible
- Brand name at end if space allows: `Content Writing for SEO | [Brand]`
- Should match what a user searching that keyword would want to click

**Meta description (≤155 characters):**
- Not a ranking factor — it's a click-rate factor
- Should contain the primary keyword (may be bolded by Google)
- Should complete the promise the title started: answer "what will I get if I click?"

### 2.3 Heading Hierarchy

- **H1:** One per page. The title. Contains the primary keyword.
- **H2:** Major sections. Should be independently meaningful and contain semantic keywords.
- **H3:** Subsections under H2. Fine-grained structure.
- **H4+:** Use sparingly. Complexity beyond H3 usually signals a content structure problem.

Rule: A reader navigating by headings only should understand the piece's full argument and scope.

### 2.4 E-E-A-T Signals (Experience, Expertise, Authoritativeness, Trustworthiness)

These signals tell Google (and LLMs) that the content should be trusted:

**Experience signals:**
- First-person observations from direct experience: "When I ran this test..." / "After managing X for 3 years..."
- Specific dates, timeframes, versions ("as of Q1 2026" for evergreen relevance claims)
- Photos, data, case studies from real work

**Expertise signals:**
- Precise, technical vocabulary used correctly
- Nuance — acknowledging what the simple answer misses
- References to primary sources, not just other blog posts

**Authority signals:**
- Named author with credentials or track record
- Internal linking to related deep content (topic authority)
- Outbound links to authoritative primary sources

**Trust signals:**
- Sources cited with links where claims are not obvious
- Publication date + last updated date visible
- Clear statement when something is opinion vs. established fact

---

## 3. GEO / AEO — Getting Cited by AI Engines

### 3.1 How LLMs Select Content to Cite

LLMs (Claude, ChatGPT, Perplexity, Gemini) cite content that:
1. Contains a **direct, clear answer** to the query — ideally in the first 1-2 sentences of a section
2. Is **structured** so the answer is extractable without surrounding context
3. Contains **specific, verifiable facts** (dates, numbers, named entities) rather than vague claims
4. Is **authoritative** — the LLM's training included quality signals, not just content signals

### 3.2 GEO Formatting Techniques

**The Direct Answer Block:**
Place a concise, direct answer to the likely query in the first 2-3 sentences of the relevant section. This is the most extractable format for AI citation.

```
[SUBHEADING THAT MATCHES QUERY]
[1-2 sentence direct answer to the exact question the heading asks]
[Then: deeper context, examples, nuance]
```

**FAQ Sections:**
Explicit Q&A sections are highly citation-friendly. The question is the query; the answer is the citation text.

Structure:
```
Q: [The exact question a user would type]
A: [Direct, complete answer in 1-4 sentences. Cite the source of any claim.]
```

**Definition/Explainer Blocks:**
LLMs frequently cite definitions. The pattern:

```
[Term] is [definition]. [One sentence that adds the most important nuance.]
[Example that makes it concrete.]
```

**Numbered Lists as Structured Claims:**
LLMs extract numbered lists well, especially for "how to," "what are the steps," "what are the types of" queries.

Each list item should be a complete sentence, not a fragment. "3. Build your keyword list using search volume and competition data, targeting terms with 100-1,000 monthly searches" not "3. Keywords."

### 3.3 Semantic Structure for GEO

**Header as query:** Write H2 and H3 headings as the exact question users ask, or its close semantic equivalent. Not "Benefits of X" but "What are the benefits of X?" or "Why does X improve Y?"

**Chunk content into extractable units:** Each section should be able to stand alone as a complete answer to the heading's question. LLMs don't always have access to surrounding context when citing.

**Use "According to" and citation language:** When citing your own research, data, or original analysis, frame it in the language that LLMs recognize as attributable: "According to [Ankit's analysis of X]..." or "Our research found that..."

**Entity-rich writing:** Name specific people, companies, tools, places, studies. Vague writing ("many studies show") is rarely cited. Named, specific writing ("a 2024 Stanford study by [researcher]") is.

### 3.4 Content Types That Get AI-Cited Most

| Content Type | Citation Frequency | Why |
|---|---|---|
| Definitions and explainers | Very high | Directly answers "what is X" queries |
| Step-by-step how-to guides | High | LLMs use for procedural queries |
| Comparison tables | High | Structured, extractable, factual |
| FAQ sections | Very high | Direct Q&A is the ideal LLM citation format |
| Statistics with attribution | High | Verifiable, specific, citable |
| Original research/data | Highest | Novel, authoritative, unique |

---

## 4. Topical Authority Architecture

### 4.1 The Cluster Model

Topical authority means owning a topic comprehensively, not just ranking for individual keywords. Architecture:

```
PILLAR PAGE (1 per topic cluster)
├── Comprehensive coverage of the broad topic
├── 2,500-4,000 words
├── Internally links to all cluster pages
└── Target: high-volume, competitive head keyword

CLUSTER PAGES (5-15 per pillar)
├── Deep coverage of one specific subtopic
├── 1,000-2,000 words each
├── Links to the pillar page + related clusters
└── Target: long-tail, specific keywords
```

### 4.2 Content Gap Analysis

Before writing, identify what search (and AI queries) returns currently. The opportunity is in:
- Topics covered shallowly by existing content
- Questions asked but not directly answered
- The intersection of two topics no one has covered together
- Content where the ranked results are old and haven't been updated

---

## 5. Schema Markup Patterns

Schema.org structured data helps both search engines and LLMs parse content accurately.

**Article schema (all blog/editorial content):**
```json
{
  "@type": "Article",
  "headline": "[H1 title]",
  "author": { "@type": "Person", "name": "[Author name]" },
  "datePublished": "[ISO date]",
  "dateModified": "[ISO date]",
  "description": "[Meta description]"
}
```

**FAQ schema (FAQ sections):**
```json
{
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "[Question text]",
      "acceptedAnswer": { "@type": "Answer", "text": "[Answer text]" }
    }
  ]
}
```

**HowTo schema (tutorial content):**
```json
{
  "@type": "HowTo",
  "name": "[Title]",
  "step": [
    { "@type": "HowToStep", "name": "[Step title]", "text": "[Step description]" }
  ]
}
```

---

## 6. The SEO+GEO Quality Checklist

Before publishing any optimized content:

**Search optimization:**
- [ ] Primary keyword in H1, first 100 words, at least one H2, URL, meta title, meta description
- [ ] Meta title ≤60 characters, meta description ≤155 characters
- [ ] H1-H3 hierarchy is logical and independently scannable
- [ ] E-E-A-T signals present: named author, first-person experience, cited sources
- [ ] Internal links to related content (minimum 3-5 for pillar content)
- [ ] External links to authoritative primary sources where claims are cited
- [ ] Publication and modification dates visible

**GEO/AEO optimization:**
- [ ] Direct answer appears in first 2-3 sentences of each major section
- [ ] FAQ section present with explicit Q&A format
- [ ] At least one comparison table, definition block, or numbered step-by-step section
- [ ] Named entities throughout (specific people, studies, companies, dates)
- [ ] No vague claims without attribution or evidence
- [ ] Headings written as questions or specific claims (not topic labels)

**Content quality (from content-writing-core scorecard):**
- [ ] Quality score ≥ 70 overall, no dimension below 5
