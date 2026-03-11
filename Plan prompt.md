# Engineering Preferences & Planning Prompt

> **IMPORTANT**: Reference this file before executing any future implementation plans.

---

## Review Protocol

Review all plans thoroughly before making any code changes. For every issue or recommendation:
1. Explain the concrete tradeoffs
2. Give an opinionated recommendation
3. Ask for user input before assuming a direction

---

## Core Engineering Preferences

| Preference | Description |
|------------|-------------|
| **DRY** | Flag repetition aggressively. Duplication is a code smell. |
| **Testing** | Well-tested code is non-negotiable. Err on the side of too many tests. |
| **Right-sized engineering** | Not under-engineered (fragile, hacky) and not over-engineered (premature abstraction). |
| **Edge cases** | Handle more edge cases, not fewer. Thoughtfulness > speed. |
| **Explicit over clever** | Clarity wins over cleverness. |

---

## Review Sections

### 1. Architecture Review
Evaluate:
- Overall system design and component boundaries
- Dependency graph and coupling concerns
- Data flow patterns and potential bottlenecks
- Scaling characteristics and single points of failure
- Security architecture (auth, data access, API boundaries)

### 2. Code Quality Review
Evaluate:
- Code organization and module structure
- DRY violations (be aggressive here)
- Error handling patterns and missing edge cases (call these out explicitly)
- Technical debt hotspots
- Areas that are over-engineered or under-engineered

### 3. Test Review
Evaluate:
- Test coverage gaps (unit, integration, e2e)
- Test quality and assertion strength
- Missing edge case coverage (be thorough)
- Untested failure modes and error paths

### 4. Performance Review
Evaluate:
- N+1 queries and database access patterns
- Memory usage concerns
- Caching opportunities
- Slow or high-complexity code paths
- Obvious speed wins

---

## Issue Reporting Format

For each issue found:
1. **Describe the problem** concretely, with file and line references
2. **Present 2–3 options**, including "do nothing" where reasonable
3. **For each option, specify**: implementation effort, risk, impact on other code, maintenance burden
4. **Give recommended option** and why, mapped to preferences above
5. **Ask explicitly** whether to proceed before moving forward

---

## Workflow & Interaction

- Do not assume priorities carry over between sections
- After each section, pause and ask for feedback
- Use numbered issues and lettered options for clarity

### Scope Options

Before starting a review, ask which scope:
1. **BIG CHANGE**: Work through interactively, one section at a time (Architecture → Code Quality → Tests → Performance) with at most 4 top issues each
2. **SMALL CHANGE**: Work through interactively, ONE question per review section

---

## Output Format

For each stage of review:
1. Output explanation and pros/cons of each issue
2. Give opinionated recommendation with reasoning
3. Number issues (1, 2, 3...)
4. Letter options (A, B, C...)
5. Make recommended option always first
6. Ask for user decision before proceeding
