# TradeBooks AI Agent Guide

This guide explains the current AI agent architecture and the pattern to follow when adding new agents or tools. It is intended for Codex, Claude, and any other AI coding agent working in this repo.

## Current Architecture

TradeBooks uses AI SDK v6 experimental agents with OpenRouter as the model provider.

Key files:

- `src/lib/ai/openrouter.ts` - shared OpenRouter model factory.
- `src/lib/ai/agents/tradebook-agent.ts` - batch-scoped tradebook assistant.
- `src/lib/ai/tools/tradebook-tools.ts` - read-only tools for uploaded batch data.
- `src/app/api/agent/tradebook/route.ts` - protected streaming route for the batch assistant.
- `src/components/agent/tradebook-chat.tsx` - batch assistant UI.
- `src/lib/ai/agents/support-agent.ts` - general support assistant.
- `src/lib/ai/tools/support-tools.ts` - static product/support knowledge tools.
- `src/app/api/agent/support/route.ts` - protected streaming route for support.
- `src/components/agent/support-chat-fab.tsx` - floating support chat UI.

The shared model helper reads:

- `OPENROUTER_API_KEY` - required at runtime for agent calls.
- `OPENROUTER_MODEL` - optional, defaults to `openai/gpt-4o-mini`.

Do not instantiate the model at module import time in files that are loaded during build. Keep model access inside agent factory functions so builds do not require an API key.

## Existing Agents

### Tradebook Assistant

Purpose: answer questions about one authenticated user's selected batch.

Route: `POST /api/agent/tradebook`

Context passed by the route:

```ts
{
  userId: string;
  batchId: string;
}
```

Important behavior:

- Requires auth.
- Verifies the selected batch belongs to the authenticated user.
- Uses tools before answering factual questions about trades, files, checks, batches, vouchers, or closing lots.
- Does not claim extracted trade rows are stored in the database.
- Parses uploaded files in memory when a tool needs detailed trade data.
- Does not modify data.

### Support Assistant

Purpose: answer general app, FAQ, file requirement, workflow, privacy, Zerodha, and Tally questions.

Route: `POST /api/agent/support`

Context passed by the route:

```ts
{
  userId: string;
}
```

Important behavior:

- Requires auth.
- Uses static support tools for grounded product knowledge.
- Does not answer user-specific tradebook or batch questions.
- Directs batch-specific questions to the batch Ask AI assistant.
- States clearly that TradeBooks is file-upload based and does not connect directly to Zerodha or Tally.

## Agent Pattern

Agents live in `src/lib/ai/agents`.

Use this shape:

```ts
import { stepCountIs, ToolLoopAgent, type UIMessage } from 'ai';
import { getOpenRouterModel } from '@/lib/ai/openrouter';
import { myAgentTools, type MyAgentContext } from '@/lib/ai/tools/my-agent-tools';

const MY_AGENT_INSTRUCTIONS = `You are ...`;

export function createMyAgent() {
  return new ToolLoopAgent<MyAgentContext, typeof myAgentTools>({
    id: 'my-agent',
    model: getOpenRouterModel(),
    tools: myAgentTools,
    stopWhen: stepCountIs(5),
    temperature: 0.2,
    instructions: MY_AGENT_INSTRUCTIONS,
    prepareCall: ({ options, ...call }) => ({
      ...call,
      experimental_context: options,
    }),
  });
}

export type MyAgentMessage = UIMessage;
```

Critical detail: keep `...call` inside `prepareCall`. Dropping it removes the prompt/messages and causes:

```txt
AI_InvalidPromptError: Invalid prompt: prompt or messages must be defined
```

Use `experimental_context` to pass server-authenticated context into tools. Do not ask the user for IDs that the server already knows.

## Tool Pattern

Tools live in `src/lib/ai/tools`.

Use `tool` from `ai` and `zod` schemas:

```ts
import { tool } from 'ai';
import { z } from 'zod';

export interface MyAgentContext {
  userId: string;
}

function getContext(context: unknown): MyAgentContext {
  if (
    typeof context === 'object' &&
    context !== null &&
    'userId' in context &&
    typeof context.userId === 'string'
  ) {
    return { userId: context.userId };
  }

  throw new Error('Missing authenticated agent context');
}

export const myAgentTools = {
  getSomething: tool({
    description: 'Describe exactly when the model should use this tool.',
    inputSchema: z.object({
      limit: z.number().int().min(1).max(25).optional().default(10),
    }),
    execute: async ({ limit }, { experimental_context }) => {
      const { userId } = getContext(experimental_context);
      return {
        userId,
        limit,
        result: [],
      };
    },
  }),
};
```

Tool rules:

- Validate all tool inputs with Zod.
- Treat `experimental_context` as untrusted until validated.
- Re-check ownership in tools that read user data.
- Keep tools deterministic and narrow.
- Prefer read-only tools for assistants unless the product explicitly needs mutations.
- Never expose secrets, storage paths, raw credentials, or cross-user data.
- Do not introduce `any` in new tool code.

## API Route Pattern

Agent routes live in `src/app/api/agent/<agent-name>/route.ts`.

Use this shape:

```ts
import { createAgentUIStreamResponse, type UIMessage } from 'ai';
import { createMyAgent } from '@/lib/ai/agents/my-agent';
import { getAuthenticatedUserId } from '@/lib/supabase/auth-guard';

export const maxDuration = 60;

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json() as {
    messages?: UIMessage[];
  };

  if (!Array.isArray(body.messages)) {
    return Response.json({ error: 'messages must be an array' }, { status: 400 });
  }

  return createAgentUIStreamResponse({
    agent: createMyAgent(),
    uiMessages: body.messages,
    options: {
      userId,
    },
  });
}
```

For resource-scoped agents, validate the resource before streaming:

1. Authenticate the user.
2. Validate request body shape.
3. Load the resource from the repository.
4. Confirm `resource.user_id === userId`.
5. Pass only the needed context through `options`.

## React Chat Pattern

Client chat components use `@ai-sdk/react` and `DefaultChatTransport`.

Use this shape:

```tsx
'use client';

import { useMemo, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { MyAgentMessage } from '@/lib/ai/agents/my-agent';

export function MyAgentChat() {
  const [input, setInput] = useState('');

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/agent/my-agent',
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            messages,
          },
        }),
      }),
    [],
  );

  const { messages, sendMessage, status, error } = useChat<MyAgentMessage>({
    transport,
  });

  const isBusy = status === 'submitted' || status === 'streaming';

  // Render messages and submit with sendMessage({ text: input.trim() }).
}
```

For scoped agents, include the scope ID in the request body:

```ts
prepareSendMessagesRequest: ({ messages }) => ({
  body: {
    batchId,
    messages,
  },
})
```

## Choosing What to Build

Create a separate agent when:

- It has a different job, permission boundary, or system prompt.
- It uses a different data source or resource scope.
- It should be mounted in a different UI surface.
- It needs tools that should not be available to existing agents.

Add a tool to an existing agent when:

- The agent's purpose is unchanged.
- The new capability is another read path for the same resource/context.
- The current system prompt can safely govern the new tool.

Do not put support, batch analysis, account settings, and admin operations into one all-powerful agent. Keep agents narrow and permission boundaries obvious.

## Data and Privacy Rules

For TradeBooks specifically:

- Uploaded files and generated artifacts are retained for batch history and audit traceability.
- Extracted trade rows are not a general database-backed chat memory. Batch tools parse uploaded files in memory when needed.
- General support tools must not read user upload data.
- Batch tools must verify both authenticated user and batch ownership.
- Agents should not provide tax, legal, or accounting advice.
- Agents may explain generated output, warnings, checks, and product behavior.

## Adding a New Agent Checklist

1. Create `src/lib/ai/tools/<agent-name>-tools.ts`.
2. Define a typed context interface.
3. Add narrow, Zod-validated tools.
4. Create `src/lib/ai/agents/<agent-name>-agent.ts`.
5. Add strong instructions that define scope, refusal boundaries, and tool usage rules.
6. Include `prepareCall: ({ options, ...call }) => ({ ...call, experimental_context: options })`.
7. Create `src/app/api/agent/<agent-name>/route.ts`.
8. Authenticate the route and verify resource ownership before streaming.
9. Create or update the UI component using `DefaultChatTransport`.
10. Run checks with Bun.

## Verification

Use Bun only:

```bash
bun run lint
bun run test:run
bun run build
```

Do not use npm, do not create `package-lock.json`, and do not commit generated output such as `.next`, `node_modules`, or build artifacts.

## Common Failure Modes

- `Invalid prompt: prompt or messages must be defined`
  - Usually means `prepareCall` returned only `experimental_context` and dropped `...call`.

- Build fails because `OPENROUTER_API_KEY` is missing
  - Usually means the model was instantiated at module import time. Move it inside the agent factory.

- Agent answers from general knowledge instead of app truth
  - Add or improve a tool, then update instructions to require the tool for factual product/data questions.

- Agent leaks cross-user data
  - Fix route authorization and tool-level ownership checks. Never trust client-supplied user IDs.

- Support agent answers specific trade questions
  - Tighten support instructions and redirect the user to the selected batch assistant.
