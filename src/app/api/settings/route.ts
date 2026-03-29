import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSettingsRepository } from '@/lib/db';
import { DEFAULT_USER_SETTINGS } from '@/lib/db/settings-repository';
import type { UserSettings } from '@/lib/types/domain';

async function getAuthenticatedUserId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const repo = getSettingsRepository();
    const settings = await repo.getSettings(userId);

    if (!settings) {
      const defaults: UserSettings = {
        ...DEFAULT_USER_SETTINGS,
        user_id: userId,
        updated_at: new Date().toISOString(),
      };
      return NextResponse.json(defaults);
    }

    return NextResponse.json(settings);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load settings';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate enum values
    const validModes = ['INVESTOR', 'TRADER'];
    const validCostBasis = ['FIFO', 'WEIGHTED_AVERAGE'];
    const validChargeTreatment = ['CAPITALIZE', 'EXPENSE', 'HYBRID'];
    const validGranularity = ['TRADE_LEVEL', 'CONTRACT_NOTE_LEVEL', 'DAILY_SUMMARY_BY_SCRIPT', 'DAILY_SUMMARY_POOLED'];
    const validLedgerStrategy = ['SCRIPT_LEVEL', 'POOLED'];

    const updates: Partial<Omit<UserSettings, 'user_id' | 'updated_at'>> = {};

    if (body.company_name !== undefined) {
      if (typeof body.company_name !== 'string') {
        return NextResponse.json({ error: 'company_name must be a string' }, { status: 400 });
      }
      updates.company_name = body.company_name;
    }
    if (body.accounting_mode !== undefined) {
      if (!validModes.includes(body.accounting_mode)) {
        return NextResponse.json({ error: `accounting_mode must be one of: ${validModes.join(', ')}` }, { status: 400 });
      }
      updates.accounting_mode = body.accounting_mode;
    }
    if (body.cost_basis_method !== undefined) {
      if (!validCostBasis.includes(body.cost_basis_method)) {
        return NextResponse.json({ error: `cost_basis_method must be one of: ${validCostBasis.join(', ')}` }, { status: 400 });
      }
      updates.cost_basis_method = body.cost_basis_method;
    }
    if (body.charge_treatment !== undefined) {
      if (!validChargeTreatment.includes(body.charge_treatment)) {
        return NextResponse.json({ error: `charge_treatment must be one of: ${validChargeTreatment.join(', ')}` }, { status: 400 });
      }
      updates.charge_treatment = body.charge_treatment;
    }
    if (body.voucher_granularity !== undefined) {
      if (!validGranularity.includes(body.voucher_granularity)) {
        return NextResponse.json({ error: `voucher_granularity must be one of: ${validGranularity.join(', ')}` }, { status: 400 });
      }
      updates.voucher_granularity = body.voucher_granularity;
    }
    if (body.ledger_strategy !== undefined) {
      if (!validLedgerStrategy.includes(body.ledger_strategy)) {
        return NextResponse.json({ error: `ledger_strategy must be one of: ${validLedgerStrategy.join(', ')}` }, { status: 400 });
      }
      updates.ledger_strategy = body.ledger_strategy;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const repo = getSettingsRepository();
    const saved = await repo.upsertSettings(userId, updates);
    return NextResponse.json(saved);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save settings';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
