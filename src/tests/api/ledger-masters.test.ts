import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SYSTEM_LEDGERS } from '@/lib/constants/ledger-names';

const ledgerRepo = {
  listOverrides: vi.fn(),
  upsertOverride: vi.fn(),
  bulkUpsertOverrides: vi.fn(),
  deleteOverride: vi.fn(),
};

vi.mock('@/lib/db', () => ({
  getLedgerRepository: () => ledgerRepo,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-001' } } }),
    },
  }),
}));

const { GET } = await import('@/app/api/ledger-masters/route');

beforeEach(() => {
  vi.clearAllMocks();
  ledgerRepo.listOverrides.mockResolvedValue([]);
});

function get(url: string) {
  return GET(new Request(url));
}

describe('GET /api/ledger-masters', () => {
  it('returns the full merged list and a total when no params are given', async () => {
    const res = await get('http://localhost/api/ledger-masters');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.total).toBe(SYSTEM_LEDGERS.length);
    expect(body.ledgers).toHaveLength(SYSTEM_LEDGERS.length);
    expect(body.ledgers.every((l: { source: string }) => l.source === 'system')).toBe(true);
  });

  it('paginates with limit/offset while reporting the full total', async () => {
    const page1 = await (await get('http://localhost/api/ledger-masters?limit=5&offset=0')).json();
    expect(page1.ledgers).toHaveLength(5);
    expect(page1.total).toBe(SYSTEM_LEDGERS.length);
    expect(page1.limit).toBe(5);
    expect(page1.offset).toBe(0);

    const page2 = await (await get('http://localhost/api/ledger-masters?limit=5&offset=5')).json();
    expect(page2.ledgers).toHaveLength(5);
    expect(page2.ledgers[0].key).not.toBe(page1.ledgers[0].key);
  });

  it('filters by query across name, group, and custom key', async () => {
    ledgerRepo.listOverrides.mockResolvedValue([
      {
        id: 'ov-1',
        user_id: 'user-001',
        ledger_key: 'CUSTOM_ZEBRA',
        name: 'Zebra Special Ledger',
        parent_group: 'My Custom Group',
        is_custom: true,
        created_at: '2026-01-01T00:00:00Z',
      },
    ]);

    const body = await (await get('http://localhost/api/ledger-masters?q=zebra')).json();

    expect(body.total).toBe(1);
    expect(body.ledgers).toHaveLength(1);
    expect(body.ledgers[0].name).toBe('Zebra Special Ledger');
    expect(body.ledgers[0].source).toBe('custom');
  });

  it('returns an empty page (total 0) when nothing matches the query', async () => {
    const body = await (
      await get('http://localhost/api/ledger-masters?q=zzz-no-such-ledger')
    ).json();

    expect(body.total).toBe(0);
    expect(body.ledgers).toHaveLength(0);
  });
});
