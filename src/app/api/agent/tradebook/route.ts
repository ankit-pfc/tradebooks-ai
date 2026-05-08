import { createAgentUIStreamResponse, type UIMessage } from 'ai';
import { createTradebookAssistantAgent } from '@/lib/ai/agents/tradebook-agent';
import { getBatchRepository } from '@/lib/db';
import { getAuthenticatedUserId } from '@/lib/supabase/auth-guard';

export const maxDuration = 60;

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json() as {
    messages?: UIMessage[];
    batchId?: string;
  };

  if (!Array.isArray(body.messages)) {
    return Response.json({ error: 'messages must be an array' }, { status: 400 });
  }
  if (!body.batchId) {
    return Response.json({ error: 'batchId is required' }, { status: 400 });
  }

  const batch = await getBatchRepository().getBatch(body.batchId);
  if (!batch) {
    return Response.json({ error: `Batch not found: ${body.batchId}` }, { status: 404 });
  }
  if (batch.user_id !== userId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  return createAgentUIStreamResponse({
    agent: createTradebookAssistantAgent(),
    uiMessages: body.messages,
    options: {
      userId,
      batchId: body.batchId,
    },
  });
}
