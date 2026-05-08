import { createOpenRouter } from '@openrouter/ai-sdk-provider';

export function getOpenRouterModel() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is required to use the TradeBooks assistant');
  }

  const openrouter = createOpenRouter({
    apiKey,
  });

  return openrouter(process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini');
}
