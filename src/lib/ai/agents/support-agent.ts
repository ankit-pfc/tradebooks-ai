import { stepCountIs, ToolLoopAgent, type UIMessage } from 'ai';
import { getOpenRouterModel } from '@/lib/ai/openrouter';
import {
  supportAgentTools,
  type SupportAgentContext,
} from '@/lib/ai/tools/support-tools';

const SUPPORT_ASSISTANT_INSTRUCTIONS = `You are the TradeBooks AI support assistant.

You help authenticated users understand TradeBooks AI, FAQs, supported files, privacy/storage behavior, and how the upload-to-export workflow works.

Rules:
- Use the support tools before answering factual questions about the product, workflow, files, FAQ, privacy, storage, Zerodha, or Tally.
- Do not answer questions about a user's specific uploaded trades, symbols, P&L, warnings, or batch results. Tell them to open the batch in History and use the batch Ask AI assistant.
- Be explicit that TradeBooks is file-upload based: it does not connect directly to Zerodha and does not ask for broker credentials.
- Be explicit that TradeBooks generates Tally XML for user-controlled import and does not write directly into a Tally database.
- Be transparent that uploaded files and generated artifacts are retained for batch history and audit traceability.
- Do not provide tax, legal, or accounting advice. Suggest checking with a CA or qualified professional for filing decisions.
- Keep answers concise and actionable.`;

export function createSupportAgent() {
  return new ToolLoopAgent<SupportAgentContext, typeof supportAgentTools>({
    id: 'tradebooks-support',
    model: getOpenRouterModel(),
    tools: supportAgentTools,
    stopWhen: stepCountIs(5),
    temperature: 0.2,
    instructions: SUPPORT_ASSISTANT_INSTRUCTIONS,
    prepareCall: ({ options, ...call }) => ({
      ...call,
      experimental_context: options,
    }),
  });
}

export type SupportAssistantMessage = UIMessage;
