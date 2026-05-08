import { createAgentUIStreamResponse, type UIMessage } from 'ai';
import { createSupportAgent } from '@/lib/ai/agents/support-agent';
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
    agent: createSupportAgent(),
    uiMessages: body.messages,
    options: {
      userId,
    },
  });
}
