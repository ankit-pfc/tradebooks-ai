import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createClient } from '@/lib/supabase/server';

export interface TallyStockItemMapping {
    id: string;
    user_id: string;
    name: string;
    base_unit: string;
    created_at: string;
}

export interface TallyStockItemInput {
    name: string;
    base_unit?: string;
}

export interface StockItemRepository {
    listStockItems(userId: string): Promise<TallyStockItemMapping[]>;
    bulkUpsertStockItems(
        userId: string,
        inputs: TallyStockItemInput[],
    ): Promise<TallyStockItemMapping[]>;
}

function getStockItemDir(): string {
    const dataDir = process.env.DATA_PATH || join(process.cwd(), '.data');
    return join(dataDir, 'tally-stock-items');
}

function filePath(userId: string): string {
    return join(getStockItemDir(), `${userId}.json`);
}

async function readStockItems(userId: string): Promise<TallyStockItemMapping[]> {
    try {
        const raw = await readFile(filePath(userId), 'utf-8');
        return JSON.parse(raw) as TallyStockItemMapping[];
    } catch {
        return [];
    }
}

async function writeStockItems(
    userId: string,
    items: TallyStockItemMapping[],
): Promise<void> {
    await mkdir(getStockItemDir(), { recursive: true });
    await writeFile(filePath(userId), JSON.stringify(items, null, 2), 'utf-8');
}

export const localStockItemRepository: StockItemRepository = {
    async listStockItems(userId) {
        return readStockItems(userId);
    },

    async bulkUpsertStockItems(userId, inputs) {
        const existing = await readStockItems(userId);
        const byName = new Map(existing.map((item) => [item.name.trim().toUpperCase(), item]));
        const results: TallyStockItemMapping[] = [];

        for (const input of inputs) {
            const name = input.name.trim();
            if (!name) continue;
            const key = name.toUpperCase();
            const current = byName.get(key);
            const entry: TallyStockItemMapping = {
                id: current?.id ?? crypto.randomUUID(),
                user_id: userId,
                name,
                base_unit: input.base_unit?.trim() || current?.base_unit || 'NOS',
                created_at: current?.created_at ?? new Date().toISOString(),
            };
            byName.set(key, entry);
            results.push(entry);
        }

        await writeStockItems(userId, Array.from(byName.values()));
        return results;
    },
};

export const supabaseStockItemRepository: StockItemRepository = {
    async listStockItems(userId) {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('user_tally_stock_items')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: true });

        if (error?.message?.includes('schema cache')) return [];
        if (error) throw new Error(`listStockItems failed: ${error.message}`);
        return (data ?? []) as TallyStockItemMapping[];
    },

    async bulkUpsertStockItems(userId, inputs) {
        const rows = inputs
            .map((input) => ({
                user_id: userId,
                name: input.name.trim(),
                base_unit: input.base_unit?.trim() || 'NOS',
            }))
            .filter((row) => row.name.length > 0);

        if (rows.length === 0) return [];

        const supabase = await createClient();
        const { data, error } = await supabase
            .from('user_tally_stock_items')
            .upsert(rows, { onConflict: 'user_id,name' })
            .select();

        if (error?.message?.includes('schema cache')) {
            throw new Error('Tally stock items table not yet available. Please run the database migration.');
        }
        if (error) throw new Error(`bulkUpsertStockItems failed: ${error.message}`);
        return (data ?? []) as TallyStockItemMapping[];
    },
};
