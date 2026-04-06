import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createClient } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LedgerOverride {
    id: string;
    user_id: string;
    ledger_key: string;
    name: string;
    parent_group: string;
    is_custom: boolean;
    created_at: string;
}

export interface LedgerOverrideInput {
    ledger_key: string;
    name: string;
    parent_group: string;
    is_custom?: boolean;
}

export interface LedgerRepository {
    listOverrides(userId: string): Promise<LedgerOverride[]>;
    upsertOverride(userId: string, input: LedgerOverrideInput): Promise<LedgerOverride>;
    bulkUpsertOverrides(userId: string, inputs: LedgerOverrideInput[]): Promise<LedgerOverride[]>;
    deleteOverride(userId: string, ledgerKey: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Local file adapter
// ---------------------------------------------------------------------------

function getLedgerDir(): string {
    const dataDir = process.env.DATA_PATH || join(process.cwd(), '.data');
    return join(dataDir, 'ledger-overrides');
}

function filePath(userId: string): string {
    return join(getLedgerDir(), `${userId}.json`);
}

async function readOverrides(userId: string): Promise<LedgerOverride[]> {
    try {
        const raw = await readFile(filePath(userId), 'utf-8');
        return JSON.parse(raw) as LedgerOverride[];
    } catch {
        return [];
    }
}

async function writeOverrides(userId: string, overrides: LedgerOverride[]): Promise<void> {
    const dir = getLedgerDir();
    await mkdir(dir, { recursive: true });
    await writeFile(filePath(userId), JSON.stringify(overrides, null, 2), 'utf-8');
}

export const localLedgerRepository: LedgerRepository = {
    async listOverrides(userId) {
        return readOverrides(userId);
    },

    async upsertOverride(userId, input) {
        const overrides = await readOverrides(userId);
        const idx = overrides.findIndex((o) => o.ledger_key === input.ledger_key);
        const entry: LedgerOverride = {
            id: idx >= 0 ? overrides[idx].id : crypto.randomUUID(),
            user_id: userId,
            ledger_key: input.ledger_key,
            name: input.name,
            parent_group: input.parent_group,
            is_custom: input.is_custom ?? false,
            created_at: idx >= 0 ? overrides[idx].created_at : new Date().toISOString(),
        };
        if (idx >= 0) {
            overrides[idx] = entry;
        } else {
            overrides.push(entry);
        }
        await writeOverrides(userId, overrides);
        return entry;
    },

    async bulkUpsertOverrides(userId, inputs) {
        const overrides = await readOverrides(userId);
        const results: LedgerOverride[] = [];
        for (const input of inputs) {
            const idx = overrides.findIndex((o) => o.ledger_key === input.ledger_key);
            const entry: LedgerOverride = {
                id: idx >= 0 ? overrides[idx].id : crypto.randomUUID(),
                user_id: userId,
                ledger_key: input.ledger_key,
                name: input.name,
                parent_group: input.parent_group,
                is_custom: input.is_custom ?? true,
                created_at: idx >= 0 ? overrides[idx].created_at : new Date().toISOString(),
            };
            if (idx >= 0) {
                overrides[idx] = entry;
            } else {
                overrides.push(entry);
            }
            results.push(entry);
        }
        await writeOverrides(userId, overrides);
        return results;
    },

    async deleteOverride(userId, ledgerKey) {
        const overrides = await readOverrides(userId);
        const filtered = overrides.filter((o) => o.ledger_key !== ledgerKey);
        await writeOverrides(userId, filtered);
    },
};

// ---------------------------------------------------------------------------
// Supabase adapter
// ---------------------------------------------------------------------------

export const supabaseLedgerRepository: LedgerRepository = {
    async listOverrides(userId) {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('user_ledger_overrides')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: true });

        if (error) throw new Error(`listOverrides failed: ${error.message}`);
        return (data ?? []) as LedgerOverride[];
    },

    async upsertOverride(userId, input) {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('user_ledger_overrides')
            .upsert(
                {
                    user_id: userId,
                    ledger_key: input.ledger_key,
                    name: input.name,
                    parent_group: input.parent_group,
                    is_custom: input.is_custom ?? false,
                },
                { onConflict: 'user_id,ledger_key' },
            )
            .select()
            .single();

        if (error) throw new Error(`upsertOverride failed: ${error.message}`);
        return data as LedgerOverride;
    },

    async bulkUpsertOverrides(userId, inputs) {
        const supabase = await createClient();
        const rows = inputs.map((input) => ({
            user_id: userId,
            ledger_key: input.ledger_key,
            name: input.name,
            parent_group: input.parent_group,
            is_custom: input.is_custom ?? true,
        }));
        const { data, error } = await supabase
            .from('user_ledger_overrides')
            .upsert(rows, { onConflict: 'user_id,ledger_key' })
            .select();

        if (error) throw new Error(`bulkUpsertOverrides failed: ${error.message}`);
        return (data ?? []) as LedgerOverride[];
    },

    async deleteOverride(userId, ledgerKey) {
        const supabase = await createClient();
        const { error } = await supabase
            .from('user_ledger_overrides')
            .delete()
            .eq('user_id', userId)
            .eq('ledger_key', ledgerKey);

        if (error) throw new Error(`deleteOverride failed: ${error.message}`);
    },
};
