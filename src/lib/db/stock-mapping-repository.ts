import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createClient } from '@/lib/supabase/server';

export type TallySecurityMappingSource =
  | 'manual'
  | 'tally_alias'
  | 'auto_exact'
  | 'auto_pattern';

export interface TallySecurityMapping {
  id: string;
  user_id: string;
  security_id: string | null;
  broker_symbol: string;
  isin: string | null;
  tally_ledger_name: string;
  tally_ledger_group: string;
  tally_stock_item_name: string;
  base_unit: string;
  match_source: TallySecurityMappingSource;
  created_at: string;
  updated_at: string;
}

export interface TallySecurityMappingInput {
  security_id?: string | null;
  broker_symbol: string;
  isin?: string | null;
  tally_ledger_name: string;
  tally_ledger_group: string;
  tally_stock_item_name: string;
  base_unit?: string;
  match_source?: TallySecurityMappingSource;
}

export interface StockMappingRepository {
  listMappings(userId: string): Promise<TallySecurityMapping[]>;
  upsertMapping(userId: string, input: TallySecurityMappingInput): Promise<TallySecurityMapping>;
  bulkUpsertMappings(
    userId: string,
    inputs: TallySecurityMappingInput[],
  ): Promise<TallySecurityMapping[]>;
}

function getMappingDir(): string {
  const dataDir = process.env.DATA_PATH || join(process.cwd(), '.data');
  return join(dataDir, 'tally-security-mappings');
}

function filePath(userId: string): string {
  return join(getMappingDir(), `${userId}.json`);
}

function mappingKey(input: Pick<TallySecurityMapping, 'broker_symbol'>): string {
  return `SYMBOL:${input.broker_symbol.trim().toUpperCase()}`;
}

async function readMappings(userId: string): Promise<TallySecurityMapping[]> {
  try {
    const raw = await readFile(filePath(userId), 'utf-8');
    return JSON.parse(raw) as TallySecurityMapping[];
  } catch {
    return [];
  }
}

async function writeMappings(userId: string, mappings: TallySecurityMapping[]): Promise<void> {
  await mkdir(getMappingDir(), { recursive: true });
  await writeFile(filePath(userId), JSON.stringify(mappings, null, 2), 'utf-8');
}

function toMapping(
  userId: string,
  input: TallySecurityMappingInput,
  current?: TallySecurityMapping,
): TallySecurityMapping {
  const now = new Date().toISOString();
  return {
    id: current?.id ?? crypto.randomUUID(),
    user_id: userId,
    security_id: input.security_id?.trim() || null,
    broker_symbol: input.broker_symbol.trim().toUpperCase(),
    isin: input.isin?.trim().toUpperCase() || null,
    tally_ledger_name: input.tally_ledger_name.trim(),
    tally_ledger_group: input.tally_ledger_group.trim(),
    tally_stock_item_name: input.tally_stock_item_name.trim(),
    base_unit: input.base_unit?.trim() || current?.base_unit || 'NOS',
    match_source: input.match_source ?? current?.match_source ?? 'manual',
    created_at: current?.created_at ?? now,
    updated_at: now,
  };
}

export const localStockMappingRepository: StockMappingRepository = {
  async listMappings(userId) {
    return readMappings(userId);
  },

  async upsertMapping(userId, input) {
    const [saved] = await this.bulkUpsertMappings(userId, [input]);
    return saved;
  },

  async bulkUpsertMappings(userId, inputs) {
    const existing = await readMappings(userId);
    const byKey = new Map(existing.map((mapping) => [mappingKey(mapping), mapping]));
    const results: TallySecurityMapping[] = [];

    for (const input of inputs) {
      if (!input.broker_symbol.trim()) continue;
      if (!input.tally_ledger_name.trim() || !input.tally_stock_item_name.trim()) continue;

      const key = mappingKey({
        broker_symbol: input.broker_symbol,
      });
      const entry = toMapping(userId, input, byKey.get(key));
      byKey.set(key, entry);
      results.push(entry);
    }

    await writeMappings(userId, Array.from(byKey.values()));
    return results;
  },
};

export const supabaseStockMappingRepository: StockMappingRepository = {
  async listMappings(userId) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('user_tally_security_mappings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error?.message?.includes('schema cache')) return [];
    if (error) throw new Error(`listMappings failed: ${error.message}`);
    return (data ?? []) as TallySecurityMapping[];
  },

  async upsertMapping(userId, input) {
    const [saved] = await this.bulkUpsertMappings(userId, [input]);
    return saved;
  },

  async bulkUpsertMappings(userId, inputs) {
    const rows = inputs
      .map((input) => ({
        user_id: userId,
        security_id: input.security_id?.trim() || null,
        broker_symbol: input.broker_symbol.trim().toUpperCase(),
        isin: input.isin?.trim().toUpperCase() || null,
        tally_ledger_name: input.tally_ledger_name.trim(),
        tally_ledger_group: input.tally_ledger_group.trim(),
        tally_stock_item_name: input.tally_stock_item_name.trim(),
        base_unit: input.base_unit?.trim() || 'NOS',
        match_source: input.match_source ?? 'manual',
        updated_at: new Date().toISOString(),
      }))
      .filter((row) =>
        row.broker_symbol.length > 0 &&
        row.tally_ledger_name.length > 0 &&
        row.tally_stock_item_name.length > 0,
      );

    if (rows.length === 0) return [];

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('user_tally_security_mappings')
      .upsert(rows, { onConflict: 'user_id,broker_symbol' })
      .select();

    if (error?.message?.includes('schema cache')) {
      throw new Error('Tally security mappings table not yet available. Please run the database migration.');
    }
    if (error) throw new Error(`bulkUpsertMappings failed: ${error.message}`);
    return (data ?? []) as TallySecurityMapping[];
  },
};
