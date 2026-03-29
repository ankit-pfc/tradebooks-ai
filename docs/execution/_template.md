# <Module Title>

## Goal
<Single-sentence target outcome>

## Why this matters
- <Business/engineering value>

## In scope
- <Task>
- <Task>

## Out of scope
- <Explicitly excluded work>

## Dependencies
- Upstream modules: `<id-name.md>`
- Blocking decisions: <if any>

## Likely files to touch
- `src/...`
- `src/...`

## Context mode
<!-- Declare one: Greenfield | Legacy/wiring -->
- Mode:
- Rationale:

## Task breakdown
<!-- G1: First step must always be writing tests that define the behavior. -->
1. Write tests covering: <exact behaviors, edge cases, error paths>
2. <Implementation step>
3. <Implementation step>

## Acceptance criteria
- [ ] Tests written before implementation (G1)
- [ ] `npm run test` passes for this module
- [ ] <Measurable outcome>
- [ ] <Measurable outcome>

## Validation steps
- `npm run test -- <target or subset>`
- `npm run lint -- <optional target>`
- Manual checks:
  - <check>

## Handoff notes
<!-- G4: Required self-review answers before marking complete. -->
- Context mode (greenfield / legacy): <!-- G6 -->
- What changed:
- What remains:
- Assumptions made (not explicitly stated in spec):
- Edge cases / failure modes not yet covered by tests:
- Conflicts or risks with existing architecture:
- High-risk areas requiring human sign-off (auth / migrations / export correctness): <!-- G5 -->

## Open questions
- <Question>
