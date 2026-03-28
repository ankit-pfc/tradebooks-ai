import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';

// Mock the Supabase server client before importing the module under test
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { localSettingsRepository } from '../settings-repository';

const TEST_DATA_DIR = join(process.cwd(), '.data-test-settings');

beforeEach(() => {
  process.env.DATA_PATH = TEST_DATA_DIR;
});

afterEach(async () => {
  delete process.env.DATA_PATH;
  try {
    await rm(TEST_DATA_DIR, { recursive: true, force: true });
  } catch { /* ok if doesn't exist */ }
});

describe('localSettingsRepository', () => {
  it('returns null for non-existent user', async () => {
    const settings = await localSettingsRepository.getSettings('nonexistent');
    expect(settings).toBeNull();
  });

  it('upserts and retrieves settings', async () => {
    const saved = await localSettingsRepository.upsertSettings('user-1', {
      company_name: 'Test Corp',
      accounting_mode: 'TRADER',
    });

    expect(saved.user_id).toBe('user-1');
    expect(saved.company_name).toBe('Test Corp');
    expect(saved.accounting_mode).toBe('TRADER');
    // Defaults applied for unset fields
    expect(saved.cost_basis_method).toBe('FIFO');
    expect(saved.charge_treatment).toBe('HYBRID');

    const retrieved = await localSettingsRepository.getSettings('user-1');
    expect(retrieved).not.toBeNull();
    expect(retrieved!.company_name).toBe('Test Corp');
    expect(retrieved!.accounting_mode).toBe('TRADER');
  });

  it('updates existing settings without losing other fields', async () => {
    await localSettingsRepository.upsertSettings('user-1', {
      company_name: 'Original Corp',
      accounting_mode: 'INVESTOR',
    });

    const updated = await localSettingsRepository.upsertSettings('user-1', {
      cost_basis_method: 'WEIGHTED_AVERAGE',
    });

    expect(updated.company_name).toBe('Original Corp'); // preserved
    expect(updated.accounting_mode).toBe('INVESTOR'); // preserved
    expect(updated.cost_basis_method).toBe('WEIGHTED_AVERAGE'); // updated
  });

  it('sets updated_at on each upsert', async () => {
    const first = await localSettingsRepository.upsertSettings('user-1', {
      company_name: 'Corp',
    });
    expect(first.updated_at).toBeTruthy();

    // Brief delay to ensure different timestamp
    await new Promise((r) => setTimeout(r, 10));

    const second = await localSettingsRepository.upsertSettings('user-1', {
      company_name: 'Corp Updated',
    });
    expect(second.updated_at).not.toBe(first.updated_at);
  });
});
