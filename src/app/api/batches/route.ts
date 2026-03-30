import { NextRequest, NextResponse } from 'next/server';
import { getBatchRepository } from '@/lib/db';
import { getAuthenticatedUserId } from '@/lib/supabase/auth-guard';
import type { AppBatchStatus } from '@/lib/types';

const VALID_STATUSES: AppBatchStatus[] = [
  'queued',
  'running',
  'succeeded',
  'failed',
  'needs_review',
];

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const repo = getBatchRepository();
    const statusParam = request.nextUrl.searchParams.get('status');
    const allBatches = await repo.listBatches();

    if (statusParam && VALID_STATUSES.includes(statusParam as AppBatchStatus)) {
      const filtered = allBatches.filter((b) => b.status === statusParam);
      return NextResponse.json({ batches: filtered });
    }

    return NextResponse.json({ batches: allBatches });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to load batches';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
