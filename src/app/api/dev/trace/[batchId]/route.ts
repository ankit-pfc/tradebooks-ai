import { NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/supabase/auth-guard';
import { getBatchRepository } from '@/lib/db';
import { isTraceEnabled, loadTrace } from '@/lib/trace';

/**
 * Returns the persisted trace bundle for a batch. Env-gated and auth-gated.
 *
 * 404 when:
 *   - TRACE_PIPELINE is unset (entire feature switched off)
 *   - batch does not exist or belongs to another user
 *   - no trace artifact has been persisted for this batch yet
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  if (!isTraceEnabled()) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { batchId } = await params;
  const batch = await getBatchRepository().getBatch(batchId);
  if (!batch || batch.user_id !== userId) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const bundle = await loadTrace(batchId);
  if (!bundle) {
    return NextResponse.json(
      { error: 'No trace bundle persisted for this batch yet.' },
      { status: 404 },
    );
  }
  return NextResponse.json(bundle);
}
