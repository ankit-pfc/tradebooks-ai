import { NextResponse } from 'next/server';
import { getBatchRepository } from '@/lib/db';
import { getAuthenticatedUserId } from '@/lib/supabase/auth-guard';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { batchId } = await params;
    const repo = getBatchRepository();
    const batch = await repo.getBatch(batchId);

    if (!batch) {
      return NextResponse.json(
        { error: `Batch not found: ${batchId}` },
        { status: 404 },
      );
    }

    return NextResponse.json({ batch });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to load batch';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
