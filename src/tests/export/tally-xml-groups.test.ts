import { describe, expect, it } from 'vitest';
import { generateMastersXml, generateFullExport } from '../../lib/export/tally-xml';
import type { LedgerMasterInput, GroupMasterInput } from '../../lib/export/tally-xml';

describe('generateMastersXml — GROUP master generation', () => {
  const ledgers: LedgerMasterInput[] = [
    { name: 'Bank Account', parent_group: 'Bank Accounts' },
    { name: 'RELIANCE-SH', parent_group: 'ZERODHA-Investment' },
  ];

  const groups: GroupMasterInput[] = [
    { name: 'ZERODHA-Investment', parent: 'Investments' },
    { name: 'Capital A/c - STCG', parent: 'Capital Account' },
  ];

  it('emits GROUP elements before LEDGER elements when groups are provided', () => {
    const xml = generateMastersXml(ledgers, 'Test Co', groups);

    // GROUP elements should appear
    expect(xml).toContain('<GROUP NAME="ZERODHA-Investment" ACTION="Create">');
    expect(xml).toContain('<PARENT>Investments</PARENT>');
    expect(xml).toContain('<GROUP NAME="Capital A/c - STCG" ACTION="Create">');
    expect(xml).toContain('<PARENT>Capital Account</PARENT>');

    // LEDGER elements should also appear
    expect(xml).toContain('<LEDGER NAME="Bank Account" ACTION="Create">');
    expect(xml).toContain('<LEDGER NAME="RELIANCE-SH" ACTION="Create">');

    // GROUPs must come BEFORE LEDGERs (TallyPrime requirement)
    const groupPos = xml.indexOf('<GROUP NAME="ZERODHA-Investment"');
    const ledgerPos = xml.indexOf('<LEDGER NAME="Bank Account"');
    expect(groupPos).toBeLessThan(ledgerPos);
  });

  it('includes NAME.LIST inside GROUP elements', () => {
    const xml = generateMastersXml(ledgers, 'Test Co', groups);
    expect(xml).toContain('<NAME>ZERODHA-Investment</NAME>');
    expect(xml).toContain('<NAME>Capital A/c - STCG</NAME>');
  });

  it('produces valid XML without groups (backward compat)', () => {
    const xml = generateMastersXml(ledgers, 'Test Co');
    expect(xml).not.toContain('<GROUP');
    expect(xml).toContain('<LEDGER NAME="Bank Account"');
    expect(xml).toContain('<ENVELOPE>');
  });

  it('passes groups through generateFullExport', () => {
    const { mastersXml } = generateFullExport([], ledgers, 'Test Co', groups);
    expect(mastersXml).toContain('<GROUP NAME="ZERODHA-Investment"');
    expect(mastersXml).toContain('<LEDGER NAME="Bank Account"');
  });

  it('handles empty groups array same as undefined', () => {
    const xml = generateMastersXml(ledgers, 'Test Co', []);
    expect(xml).not.toContain('<GROUP');
    expect(xml).toContain('<LEDGER');
  });
});
