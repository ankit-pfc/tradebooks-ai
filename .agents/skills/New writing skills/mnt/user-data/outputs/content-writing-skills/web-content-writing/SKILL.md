---
name: web-content-writing
description: >
  Subskill for web content — blog posts, articles, evergreen guides, how-to content, and thought leadership pieces published on websites. Invoke alongside content-writing-core. Handles: scannable structure, digital reading behavior, internal linking signals, headline mechanics, meta elements, and the formatting rules that make web content perform. Use for: blog posts, knowledge base articles, FAQ pages, pillar content, evergreen guides. Do NOT use alone for pure SEO/GEO optimization (use seo-geo-writing), sales copy (use marketing-copywriting), or news articles (use news-writing).
version: 1.0
invoke_with: content-writing-core
---

# Web Content Writing — Subskill

**Inherits from:** content-writing-core (all master profiles, technique library, voice rules, quality scorecard)  
**Adds:** Digital reading behavior, scannable structure, blog/article mechanics, headline science, content architecture

---

## 1. How People Read on the Web (The Foundation)

Before any formatting decision, understand the empirical reality:

**The F-Pattern:** Eye-tracking research consistently shows web readers scan in an F-shape — full first line, partial second line, then down the left margin. The most important words must be in the first two words of sentences and headings.

**Average time before abandonment:** 15 seconds. The headline, subheading, and first paragraph must collectively answer "why should I read this?" within that window.

**Scrolling behavior:** 80% of readers never pass the fold on most pages. The content above the fold must earn the scroll.

**Implications for structure:**
- Lead with the most important information, not context-building
- Every subheading must be independently scannable and compelling
- Every paragraph must be readable in isolation — skimmers read subheadings + first sentences only
- Visual hierarchy is an argument: what is big, bold, or isolated is what you believe matters most

---

## 2. Web Content Structure Templates

### Template A — The Definitive Guide (Pillar Content)
For comprehensive, evergreen, keyword-owning content.

```
HEADLINE — Direct benefit + specificity ("How to [X]: A Complete Guide for [Audience]")
INTRO (150 words max):
  → Hook: The problem in its sharpest form
  → Stakes: What is possible / what they're missing
  → Credibility signal: Why this guide specifically
  → What they'll learn (not a generic "in this guide we'll cover" — specific outcomes)

TABLE OF CONTENTS (for 2,000+ word guides)

SECTION 1: FOUNDATION (What/Why)
  → Heading written as a question or outcome, not a topic label
  → Define the concept precisely before exploring it
  → 1 concrete example before any abstract principle

SECTION 2–N: DEPTH (How — the actual content)
  → Each section: Subheading → Key insight (2-3 sentences) → Example/Evidence → Implication
  → Never end a section with a loose thread — close each idea before moving

CONCLUSION:
  → Summary limited to one new synthesis, not a recap
  → Specific next action (what does the reader do with this?)
  → Optional: related content links (natural, not formulaic)
```

### Template B — The Opinion/Thought Leadership Post
For establishing authority and distinct perspective.

```
HEADLINE — The claim or counterintuitive point directly stated
HOOK (1-2 paragraphs):
  → The common belief that is wrong or incomplete
  → The specific evidence or experience that contradicts it
BODY:
  → Paul Graham structure: Explore the question → Surface the complication → Arrive at the earned insight
  → Morgan Housel layer: Story → Principle → Second story that validates
ENDING:
  → Shifts the frame — what is the reader's relationship to this idea now?
  → Does NOT summarize
```

### Template C — The How-To / Tutorial Post
For practical, actionable content.

```
HEADLINE — The outcome + the method ("How to [Achieve X] Using [Method]")
INTRO:
  → What they'll be able to do after reading (specific outcome)
  → What they need to know first (prerequisites — respects the reader's time)
  → How long it will take / what's involved
BODY:
  → Numbered steps where sequence matters; bullets where it doesn't
  → Each step: Action (imperative verb first) → Why this step matters → What can go wrong
  → Callout boxes for warnings, tips, or common errors
ENDING:
  → Confirmation of what they've accomplished
  → What to do next (the logical next piece of content or action)
```

---

## 3. Headline Science (From Ogilvy + Modern Data)

**The 5-second rule:** A reader gives a headline 5 seconds. In that time, they're asking: "Is this for me? Does it promise something I want? Is it believable?"

**The 80/20 split:** Ogilvy: "On average, five times as many people read the headline as read the body copy. When you've written your headline, you've spent eighty cents out of your dollar."

**Headline formulas that consistently work (with the mechanism behind each):**

| Formula | Mechanism | Example |
|---|---|---|
| How to [specific outcome] | Promises utility. Specificity builds believability. | How to Write a Newsletter 10,000 People Actually Read |
| [Number] [Things] That [Outcome] | Concreteness reduces risk; numbered content feels finite | 7 Writing Habits That Separate Professionals from Amateurs |
| Why [Common Belief] Is Wrong | Contrarian claim creates immediate tension | Why Productivity Systems Are Making You Less Productive |
| The [Real / True / Actual] [X] | Implies the reader has been misled; creates curiosity | The Real Reason Your Blog Posts Don't Get Read |
| [X] for [Specific Audience] | Filters to the right reader; makes them feel seen | Thought Leadership Content for Founders Who Hate Writing |
| What [Authority/Experience] Taught Me About [Topic] | Positions personal experience as teachable insight | What 10 Years of Newsletter Writing Taught Me About Audience |

**Headline writing process (from Ogilvy's method):**
1. Write 10 headlines before you write the post
2. Write the post
3. Write 10 more headlines
4. Choose from the second set — they'll be better

**Words that consistently underperform in headlines:**
- "Ultimate" (overused, unbelievable)
- "Amazing," "Incredible" (vague superlatives)
- "Simple," "Easy" (condescending unless the content earns it)
- "In 5 Minutes" (promissory that irritates when content takes longer)

---

## 4. Formatting Rules for Web

**Paragraph length:**
- Maximum 3-4 sentences per paragraph on web
- One-sentence paragraphs for maximum emphasis (use sparingly — once per section)
- The instinct to write longer paragraphs is correct for books; wrong for web

**Subheadings:**
- Every 300-400 words minimum
- Write subheadings as independent claims or questions, not topic labels
  - Bad: "Benefits of Content Marketing"
  - Good: "Why Content Marketing Beats Paid Ads for Long-Term Growth"
- A reader who reads only the subheadings should understand the piece's argument

**Lists:**
- Use numbered lists for sequential steps or ranked items
- Use bulleted lists for 4+ parallel items of equal importance
- Never use lists to avoid writing — lists fragment ideas that should be connected
- Maximum list length before subdividing: 7 items (the cognitive chunking limit)

**Bold and emphasis:**
- Bold the key idea in a paragraph, not random phrases
- Never bold entire sentences — dilutes the signal
- Italics for: titles, technical terms on first use, genuine rhetorical emphasis

**Images and visual breaks:**
- For 2,000+ word posts: one visual element per 500-600 words minimum
- Visuals are not decoration — they reset the reader's attention and create re-entry points for skimmers

---

## 5. Content Architecture (Internal Linking + Topic Authority)

**Hub and spoke model:**
- Pillar content (2,500-4,000 words) covers a broad topic comprehensively
- Cluster content (1,000-1,500 words) covers specific subtopics in depth
- Every cluster piece links to the pillar; the pillar links to the most important clusters
- This is both SEO architecture and reader navigation

**Internal linking rules:**
- Link when you mention a topic that is covered more deeply elsewhere — serve the reader, not the algorithm
- Anchor text should describe the destination: "here" is never the anchor text
- Maximum 5-8 internal links per 1,000 words before it becomes clutter

---

## 6. Masters to Invoke for Web Content

From the content-writing-core library, weight these masters for web content work:

| Context | Primary | Secondary | Notes |
|---|---|---|---|
| Pillar/Guide content | Paul Graham (structure) | Morgan Housel (human + concrete) | Earn every section |
| Opinion posts | Paul Graham (contrarian) | Nassim Taleb (intellectual risk) | Have a real position |
| How-to posts | James Clear (precision) | Jeff Bezos (clarity) | Every step must be actionable |
| Storytelling within posts | Morgan Housel (story-principle) | Stephen King (sensory detail) | One story per major section max |
| Headline writing | David Ogilvy (specificity + promise) | Dan Koe (uncomfortable truth) | Write 20, publish 1 |

---

## 7. Universal Bans for Web Content

Beyond the voice rules in content-writing-core, web content specifically bans:

- **"In today's fast-paced world..."** — The single worst opener in web content. Never.
- **"In this article, we'll cover..."** — Generic meta-announcement. Lead with content, not a table of contents sentence.
- **"Conclusion" as a subheading** — Every reader knows they've reached the end. Label it with something that gives the reader a reason to read the final section.
- **Burying the lead** — The most interesting thing about the piece should be in the first paragraph, not discovered on scroll.
- **"As mentioned earlier"** — If it needed to be said earlier, trust that the reader remembers. If it needs repeating, you have a structure problem.
- **The hedge parade** — "Some might argue," "it could be said," "in some cases." Qualify when genuinely uncertain; don't qualify to protect yourself from being wrong.
