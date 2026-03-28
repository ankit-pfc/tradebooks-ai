import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createClient } from '@/lib/supabase/server';
import type { UserSettings } from '@/lib/types/domain';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface SettingsRepository {
    getSettings(userId: string): Promise<UserSettings | null>;
    upsertSettings(userId: string, settings: Partial<Omit<UserSettings, 'user_id' | 'updated_at'>>): Promise<UserSettings>;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_USER_SETTINGS: Omit<UserSettings, 'user_id' | 'updated_at'> = {
    company_name: '',
    accounting_mode: 'INVESTOR',
    cost_basis_method: 'FIFO',
    charge_treatment: 'HYBRID',
    voucher_granularity: 'TRADE_LEVEL',
    ledger_strategy: 'SCRIPT_LEVEL',
};

// ---------------------------------------------------------------------------
// Local file adapter
// ---------------------------------------------------------------------------

function getSettingsDir(): string {
    const dataDir = process.env.DATA_PATH || join(process.cwd(), '.data');
    return join(dataDir, 'settings');
}

export const localSettingsRepository: SettingsRepository = {
    async getSettings(userId: string): Promise<UserSettings | null> {
        try {
            const filePath = join(getSettingsDir(), `${userId}.json`);
            const raw = await readFile(filePath, 'utf-8');
            return JSON.parse(raw) as UserSettings;
        } catch {
            return null;
        }
    },

    async upsertSettings(userId, settings): Promise<UserSettings> {
        const settingsDir = getSettingsDir();
        await mkdir(settingsDir, { recursive: true });
        const existing = await this.getSettings(userId);
        const merged: UserSettings = {
            ...DEFAULT_USER_SETTINGS,
            ...existing,
            ...settings,
            user_id: userId,
            updated_at: new Date().toISOString(),
        };
        const filePath = join(settingsDir, `${userId}.json`);
        await writeFile(filePath, JSON.stringify(merged, null, 2), 'utf-8');
        return merged;
    },
};

// ---------------------------------------------------------------------------
// Supabase adapter
// ---------------------------------------------------------------------------

export const supabaseSettingsRepository: SettingsRepository = {
    async getSettings(userId: string): Promise<UserSettings | null> {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error || !data) return null;

        return {
            user_id: data.user_id,
            company_name: data.company_name,
            accounting_mode: data.accounting_mode,
            cost_basis_method: data.cost_basis_method,
            charge_treatment: data.charge_treatment,
            voucher_granularity: data.voucher_granularity,
            ledger_strategy: data.ledger_strategy,
            updated_at: data.updated_at,
        };
    },

    async upsertSettings(userId, settings): Promise<UserSettings> {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('user_settings')
            .upsert({
                user_id: userId,
                ...settings,
                updated_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) throw new Error(`upsertSettings failed: ${error.message}`);

        return {
            user_id: data.user_id,
            company_name: data.company_name,
            accounting_mode: data.accounting_mode,
            cost_basis_method: data.cost_basis_method,
            charge_treatment: data.charge_treatment,
            voucher_granularity: data.voucher_granularity,
            ledger_strategy: data.ledger_strategy,
            updated_at: data.updated_at,
        };
    },
};
