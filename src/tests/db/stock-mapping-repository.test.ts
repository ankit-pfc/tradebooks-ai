import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// The module imports the Supabase server client at load time; stub it so the
// local adapter can be exercised without pulling in next/headers.
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

const { localStockMappingRepository } = await import('@/lib/db/stock-mapping-repository');

const USER = 'user-paged';
let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'tbai-maps-'));
  process.env.DATA_PATH = dir;

  const mapDir = join(dir, 'tally-security-mappings');
  await mkdir(mapDir, { recursive: true });

  const rows = Array.from({ length: 25 }, (_, i) => ({
    id: `id-${i}`,
    user_id: USER,
    security_id: null,
    broker_symbol: `SYM${String(i).padStart(2, '0')}`,
    isin: i === 3 ? 'INE123ZEBRA1' : null,
    tally_ledger_name: i === 7 ? 'Zebra Holdings' : `Ledger ${i}`,
    tally_ledger_group: 'INVESTMENT IN SHARES-ZERODHA',
    tally_stock_item_name: `Stock ${i}`,
    base_unit: 'NOS',
    match_source: 'manual',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }));

  await writeFile(join(mapDir, `${USER}.json`), JSON.stringify(rows), 'utf-8');
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
  delete process.env.DATA_PATH;
});

describe('localStockMappingRepository.listMappingsPaged', () => {
  it('returns a page slice with the full total', async () => {
    const { mappings, total } = await localStockMappingRepository.listMappingsPaged(USER, {
      limit: 10,
      offset: 0,
    });

    expect(total).toBe(25);
    expect(mappings).toHaveLength(10);
    expect(mappings[0].broker_symbol).toBe('SYM00');
  });

  it('applies the offset', async () => {
    const { mappings, total } = await localStockMappingRepository.listMappingsPaged(USER, {
      limit: 10,
      offset: 20,
    });

    expect(total).toBe(25);
    expect(mappings).toHaveLength(5);
    expect(mappings[0].broker_symbol).toBe('SYM20');
  });

  it('filters by query across symbol, isin, ledger, and stock item', async () => {
    const { mappings, total } = await localStockMappingRepository.listMappingsPaged(USER, {
      query: 'zebra',
    });

    // Matches the 'INE123ZEBRA1' ISIN (i=3) and the 'Zebra Holdings' ledger (i=7).
    expect(total).toBe(2);
    expect(mappings.map((m) => m.broker_symbol).sort()).toEqual(['SYM03', 'SYM07']);
  });

  it('returns the whole set when no limit is given', async () => {
    const { mappings, total } = await localStockMappingRepository.listMappingsPaged(USER, {});

    expect(total).toBe(25);
    expect(mappings).toHaveLength(25);
  });

  it('returns an empty result for an unknown user', async () => {
    const { mappings, total } = await localStockMappingRepository.listMappingsPaged('nobody', {
      limit: 10,
    });

    expect(total).toBe(0);
    expect(mappings).toHaveLength(0);
  });

  it('keeps same broker symbol mappings separate when security identity differs', async () => {
    await localStockMappingRepository.bulkUpsertMappings(USER, [
      {
        security_id: 'ISIN:INE075A01022',
        broker_symbol: 'WIPRO',
        isin: 'INE075A01022',
        tally_ledger_name: 'WIPRO-SH',
        tally_ledger_group: 'INVESTMENT IN SHARES-ZERODHA',
        tally_stock_item_name: 'WIPRO',
        base_unit: 'NOS',
      },
      {
        security_id: 'ISIN:INE075A01030',
        broker_symbol: 'WIPRO',
        isin: 'INE075A01030',
        tally_ledger_name: 'WIPRO DIV-SH',
        tally_ledger_group: 'INVESTMENT IN SHARES-ZERODHA',
        tally_stock_item_name: 'WIPRO DIV',
        base_unit: 'NOS',
      },
    ]);

    const all = await localStockMappingRepository.listMappings(USER);
    const wipro = all.filter((mapping) => mapping.broker_symbol === 'WIPRO');

    expect(wipro).toHaveLength(2);
    expect(wipro.map((mapping) => mapping.tally_stock_item_name).sort()).toEqual([
      'WIPRO',
      'WIPRO DIV',
    ]);
  });
});
