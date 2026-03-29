import { NextResponse } from 'next/server';
import { getBatchRepository } from '@/lib/db';

export async function GET() {
  try {
    const repo = getBatchRepository();
    const dashboard = await repo.buildDashboardSummary();
    return NextResponse.json(dashboard);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load dashboard';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
