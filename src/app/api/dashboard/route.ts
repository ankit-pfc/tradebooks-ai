import { NextResponse } from 'next/server';
import { getBatchRepository } from '@/lib/db';
import { getAuthenticatedUserId } from '@/lib/supabase/auth-guard';

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const repo = getBatchRepository();
    const dashboard = await repo.buildDashboardSummary();
    return NextResponse.json(dashboard);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load dashboard';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
