---
description: How to autonomously research, plan, draft, and publish SEO content at scale
---

# SEO Content Publishing Workflow

Use this workflow when the user asks to generate SEO content, run the daily publishing loop, or scale organic traffic via programmatic or blog content.

## Prerequisites

1. Identify the target keyword or topic.
2. Confirm you have access to the target codebase/CMS directory where content is stored.
3. Review `.claude/product-marketing-context.md` (or equivalent) to understand the business intent.

## Step 1: Research and Plan (The Default Node)

**Never skip this step. Do not write the article yet.**
1. Identify search intent for the target keyword (Informational, Commercial, or Transactional).
2. Competitor Analysis: If provided a target keyword, determine the top-ranking pages/competitors.
3. Plan the Outline: Write the Keyword Strategy and H2/H3 outline to `tasks/todo.md`. 
4. Self-Correction Check: If the outline misses the search intent, STOP and re-plan.
5. Provide the user with a summary of the plan before proceeding to draft.

## Step 2: Set Keyword Strategy

Define the keyword parameters in `tasks/todo.md`:
- **Primary Keyword**: Identify ONE core keyword.
- **Secondary Keywords**: Identify 2-5 secondary keywords.
- **Semantic/LSI Vocabulary**: Identify related terms.

**Placement Rules for Drafting:**
- Put Primary Keyword in: Title, H1, first 100 words, one H2, and meta description.
- Keep keyword density at 1-2%. Never force exact-match keywords; use natural variations.

## Step 3: Implement the Self-Improvement Loop

1. **Before drafting**, read `tasks/lessons.md` to ensure past mistakes are not repeated.
2. If the user corrects any part of your plan or draft, IMMEDIATELY update `tasks/lessons.md` with the new rule to prevent the same SEO mistake.

## Step 4: Draft and Verify

Write the content. Once finished, verify against this checklist before presenting it to the user.
- [ ] Title tag is between 50-60 characters.
- [ ] Meta description is 140-160 characters and includes a Call To Action (CTA).
- [ ] Keyword density is under 2%.
- [ ] Every image placeholder has descriptive alt text.
- [ ] The page contains internal links to related hub pages or articles.
- [ ] Answer honestly: "Does this satisfy intent better than the top 3 results?" If no, rewrite it.

## Step 5: Autonomous SEO Fixing

- When resolving thin content, missing meta tags, or structural issues, fix specific lines directly.
- **Do not ask for hand-holding.** Apply fixes and concisely summarize what changed and why.
- Point at specific issues with line-level fixes, minimizing context switching for the user.
