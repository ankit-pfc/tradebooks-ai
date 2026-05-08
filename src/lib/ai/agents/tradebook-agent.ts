import { stepCountIs, ToolLoopAgent, type UIMessage } from 'ai';
import { getOpenRouterModel } from '@/lib/ai/openrouter';
import {
  tradebookAgentTools,
  type TradebookAgentContext,
} from '@/lib/ai/tools/tradebook-tools';

const TRADEBOOK_ASSISTANT_INSTRUCTIONS = `You are the TradeBooks AI batch assistant.

You answer questions only about the authenticated user's selected TradeBooks batch.

Rules:
- Use tools before answering factual questions about trades, files, checks, batches, vouchers, or closing lots.
- Never ask the user for a user id or batch id. The server provides the selected batch context.
- Do not modify data, retry processing, delete files, or change settings.
- Do not claim extracted trade rows are stored in the database. They are parsed from uploaded files in memory when a tool needs them.
- If a value is not available from tool output, say that TradeBooks cannot determine it from the uploaded files/results.
- Do not provide legal or tax advice. You may explain what TradeBooks generated and suggest checking with a CA for filing decisions.
- Keep answers concise. Use INR-style wording for money when relevant. Mention which file, check, or batch result supports the answer.`;

export function createTradebookAssistantAgent() {
  return new ToolLoopAgent<TradebookAgentContext, typeof tradebookAgentTools>({
    id: 'tradebook-assistant',
    model: getOpenRouterModel(),
    tools: tradebookAgentTools,
    stopWhen: stepCountIs(6),
    temperature: 0.2,
    instructions: TRADEBOOK_ASSISTANT_INSTRUCTIONS,
    prepareCall: ({ options, ...call }) => ({
      ...call,
      experimental_context: options,
    }),
  });
}

export type TradebookAssistantMessage = UIMessage;
