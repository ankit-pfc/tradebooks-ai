import { describe, expect, it } from 'vitest';
import { parseTallyCOA, matchCOAToProfile } from '../../../lib/parsers/tally';
import type { ParsedCOA } from '../../../lib/parsers/tally';

// ---------------------------------------------------------------------------
// Test XML fixtures
// ---------------------------------------------------------------------------

const MINIMAL_COA_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <BODY>
    <IMPORTDATA>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <GROUP NAME="ZERODHA-Investment" ACTION="Create">
            <NAME.LIST><NAME>ZERODHA-Investment</NAME></NAME.LIST>
            <PARENT>Investments</PARENT>
          </GROUP>
        </TALLYMESSAGE>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="RELIANCE-SH" ACTION="Create">
            <NAME.LIST><NAME>RELIANCE-SH</NAME></NAME.LIST>
            <PARENT>ZERODHA-Investment</PARENT>
          </LEDGER>
        </TALLYMESSAGE>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="INFY-SH" ACTION="Create">
            <NAME.LIST><NAME>INFY-SH</NAME></NAME.LIST>
            <PARENT>ZERODHA-Investment</PARENT>
          </LEDGER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

const CAPITAL_ACCOUNT_COA_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <BODY>
    <IMPORTDATA>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <GROUP NAME="Capital A/c - STCG" ACTION="Create">
            <NAME.LIST><NAME>Capital A/c - STCG</NAME></NAME.LIST>
            <PARENT>Capital Account</PARENT>
          </GROUP>
        </TALLYMESSAGE>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <GROUP NAME="Capital A/c - LTCG" ACTION="Create">
            <NAME.LIST><NAME>Capital A/c - LTCG</NAME></NAME.LIST>
            <PARENT>Capital Account</PARENT>
          </GROUP>
        </TALLYMESSAGE>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <GROUP NAME="Capital A/c - Dividend" ACTION="Create">
            <NAME.LIST><NAME>Capital A/c - Dividend</NAME></NAME.LIST>
            <PARENT>Capital Account</PARENT>
          </GROUP>
        </TALLYMESSAGE>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <GROUP NAME="ZERODHA-Investment" ACTION="Create">
            <NAME.LIST><NAME>ZERODHA-Investment</NAME></NAME.LIST>
            <PARENT>Investments</PARENT>
          </GROUP>
        </TALLYMESSAGE>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="ZERODHA - KITE" ACTION="Create">
            <NAME.LIST><NAME>ZERODHA - KITE</NAME></NAME.LIST>
            <PARENT>Sundry Creditors</PARENT>
          </LEDGER>
        </TALLYMESSAGE>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="HDFC Bank" ACTION="Create">
            <NAME.LIST><NAME>HDFC Bank</NAME></NAME.LIST>
            <PARENT>Bank Accounts</PARENT>
          </LEDGER>
        </TALLYMESSAGE>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="RELIANCE-SH" ACTION="Create">
            <NAME.LIST><NAME>RELIANCE-SH</NAME></NAME.LIST>
            <PARENT>ZERODHA-Investment</PARENT>
          </LEDGER>
        </TALLYMESSAGE>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="TCS-SH" ACTION="Create">
            <NAME.LIST><NAME>TCS-SH</NAME></NAME.LIST>
            <PARENT>ZERODHA-Investment</PARENT>
          </LEDGER>
        </TALLYMESSAGE>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="STCG ON RELIANCE" ACTION="Create">
            <NAME.LIST><NAME>STCG ON RELIANCE</NAME></NAME.LIST>
            <PARENT>Capital A/c - STCG</PARENT>
          </LEDGER>
        </TALLYMESSAGE>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="STCG ON TCS" ACTION="Create">
            <NAME.LIST><NAME>STCG ON TCS</NAME></NAME.LIST>
            <PARENT>Capital A/c - STCG</PARENT>
          </LEDGER>
        </TALLYMESSAGE>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="LTCG ON RELIANCE" ACTION="Create">
            <NAME.LIST><NAME>LTCG ON RELIANCE</NAME></NAME.LIST>
            <PARENT>Capital A/c - LTCG</PARENT>
          </LEDGER>
        </TALLYMESSAGE>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="LTCG ON TCS" ACTION="Create">
            <NAME.LIST><NAME>LTCG ON TCS</NAME></NAME.LIST>
            <PARENT>Capital A/c - LTCG</PARENT>
          </LEDGER>
        </TALLYMESSAGE>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="DIV RELIANCE" ACTION="Create">
            <NAME.LIST><NAME>DIV RELIANCE</NAME></NAME.LIST>
            <PARENT>Capital A/c - Dividend</PARENT>
          </LEDGER>
        </TALLYMESSAGE>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="DIV TCS" ACTION="Create">
            <NAME.LIST><NAME>DIV TCS</NAME></NAME.LIST>
            <PARENT>Capital A/c - Dividend</PARENT>
          </LEDGER>
        </TALLYMESSAGE>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="SHARE BROKERAGE" ACTION="Create">
            <NAME.LIST><NAME>SHARE BROKERAGE</NAME></NAME.LIST>
            <PARENT>Capital Account</PARENT>
          </LEDGER>
        </TALLYMESSAGE>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="Stt" ACTION="Create">
            <NAME.LIST><NAME>Stt</NAME></NAME.LIST>
            <PARENT>Capital Account</PARENT>
          </LEDGER>
        </TALLYMESSAGE>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="TDS on Dividend" ACTION="Create">
            <NAME.LIST><NAME>TDS on Dividend</NAME></NAME.LIST>
            <PARENT>Duties &amp; Taxes</PARENT>
          </LEDGER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

const PNL_APPROACH_COA_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <BODY>
    <IMPORTDATA>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="Zerodha Broking" ACTION="Create">
            <NAME.LIST><NAME>Zerodha Broking</NAME></NAME.LIST>
            <PARENT>Sundry Creditors</PARENT>
          </LEDGER>
        </TALLYMESSAGE>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="Bank Account" ACTION="Create">
            <NAME.LIST><NAME>Bank Account</NAME></NAME.LIST>
            <PARENT>Bank Accounts</PARENT>
          </LEDGER>
        </TALLYMESSAGE>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="Short Term Capital Gain on Sale of Shares" ACTION="Create">
            <NAME.LIST><NAME>Short Term Capital Gain on Sale of Shares</NAME></NAME.LIST>
            <PARENT>Indirect Incomes</PARENT>
          </LEDGER>
        </TALLYMESSAGE>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="Brokerage" ACTION="Create">
            <NAME.LIST><NAME>Brokerage</NAME></NAME.LIST>
            <PARENT>Indirect Expenses</PARENT>
          </LEDGER>
        </TALLYMESSAGE>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="STT" ACTION="Create">
            <NAME.LIST><NAME>STT</NAME></NAME.LIST>
            <PARENT>Indirect Expenses</PARENT>
          </LEDGER>
        </TALLYMESSAGE>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="Dividend Income" ACTION="Create">
            <NAME.LIST><NAME>Dividend Income</NAME></NAME.LIST>
            <PARENT>Indirect Incomes</PARENT>
          </LEDGER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

// ---------------------------------------------------------------------------
// Tests: parseTallyCOA
// ---------------------------------------------------------------------------

describe('parseTallyCOA', () => {
  it('parses groups and ledgers from ENVELOPE-wrapped XML', () => {
    const result = parseTallyCOA(MINIMAL_COA_XML);

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].name).toBe('ZERODHA-Investment');
    expect(result.groups[0].parent).toBe('Investments');

    expect(result.ledgers).toHaveLength(2);
    expect(result.ledgers[0].name).toBe('RELIANCE-SH');
    expect(result.ledgers[1].name).toBe('INFY-SH');
  });

  it('parses a full Capital Account COA', () => {
    const result = parseTallyCOA(CAPITAL_ACCOUNT_COA_XML);

    expect(result.groups.length).toBeGreaterThanOrEqual(3);
    expect(result.ledgers.length).toBeGreaterThanOrEqual(10);

    const groupNames = result.groups.map((g) => g.name);
    expect(groupNames).toContain('Capital A/c - STCG');
    expect(groupNames).toContain('Capital A/c - LTCG');
  });

  it('returns empty result for empty string', () => {
    const result = parseTallyCOA('');
    expect(result.groups).toHaveLength(0);
    expect(result.ledgers).toHaveLength(0);
  });

  it('returns empty result for malformed XML without valid structure', () => {
    const result = parseTallyCOA('<not valid xml>>>>');
    // fast-xml-parser is lenient — no groups/ledgers found from malformed input
    expect(result.groups).toHaveLength(0);
    expect(result.ledgers).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: matchCOAToProfile
// ---------------------------------------------------------------------------

describe('matchCOAToProfile', () => {
  it('detects Capital Account approach with high confidence', () => {
    const coa = parseTallyCOA(CAPITAL_ACCOUNT_COA_XML);
    const result = matchCOAToProfile(coa);

    expect(result.confidence).toBeGreaterThan(0.3);

    // Broker detection
    expect(result.profile.broker?.name).toBe('ZERODHA - KITE');

    // Bank detection
    expect(result.profile.bank?.name).toBe('HDFC Bank');

    // Investment template detection
    expect(result.profile.investment?.template).toBe('{symbol}-SH');

    // Per-scrip capital gains
    expect(result.profile.stcg?.template).toBe('STCG ON {symbol}');
    expect(result.profile.ltcg?.template).toBe('LTCG ON {symbol}');
    expect(result.profile.perScripCapitalGains).toBe(true);

    // Per-scrip dividends
    expect(result.profile.dividend?.template).toBe('DIV {symbol}');
    expect(result.profile.perScripDividends).toBe(true);

    // Custom groups under Capital Account
    expect(result.profile.customGroups).toBeDefined();
    expect(result.profile.customGroups!.length).toBeGreaterThanOrEqual(2);
  });

  it('detects P&L approach from a simple COA', () => {
    const coa = parseTallyCOA(PNL_APPROACH_COA_XML);
    const result = matchCOAToProfile(coa);

    expect(result.profile.broker?.name).toBe('Zerodha Broking');
    expect(result.profile.bank?.name).toBe('Bank Account');

    // Charge detection
    expect(result.profile.chargeConsolidation).toBeDefined();
    const chargeNames = result.profile.chargeConsolidation!.map((c) => c.ledgerName);
    expect(chargeNames).toContain('Brokerage');
    expect(chargeNames).toContain('STT');

    // Pooled dividend (single ledger, not per-scrip)
    expect(result.profile.dividend?.template).toBe('Dividend Income');
  });

  it('detects charge ledgers by keyword matching', () => {
    const coa = parseTallyCOA(CAPITAL_ACCOUNT_COA_XML);
    const result = matchCOAToProfile(coa);

    expect(result.profile.chargeConsolidation).toBeDefined();
    const chargeNames = result.profile.chargeConsolidation!.map((c) => c.ledgerName);
    expect(chargeNames).toContain('SHARE BROKERAGE');
    expect(chargeNames).toContain('Stt');
  });

  it('detects TDS ledgers', () => {
    const coa = parseTallyCOA(CAPITAL_ACCOUNT_COA_XML);
    const result = matchCOAToProfile(coa);

    expect(result.profile.tdsOnDividend?.name).toBe('TDS on Dividend');
  });

  it('reports unmatched ledgers', () => {
    const coa = parseTallyCOA(CAPITAL_ACCOUNT_COA_XML);
    const result = matchCOAToProfile(coa);

    // Some ledgers may not match any pattern
    expect(Array.isArray(result.unmatchedLedgers)).toBe(true);
  });

  it('handles empty COA gracefully', () => {
    const coa: ParsedCOA = { groups: [], ledgers: [] };
    const result = matchCOAToProfile(coa);

    expect(result.confidence).toBe(0);
    expect(result.unmatchedLedgers).toHaveLength(0);
    expect(Object.keys(result.profile).length).toBe(0);
  });

  it('confidence increases with more matched fields', () => {
    const simpleCOA: ParsedCOA = {
      groups: [],
      ledgers: [
        { name: 'Zerodha Broking', parent: 'Sundry Creditors', type: 'LEDGER' },
      ],
    };

    const simpleResult = matchCOAToProfile(simpleCOA);

    const fullCOA = parseTallyCOA(CAPITAL_ACCOUNT_COA_XML);
    const fullResult = matchCOAToProfile(fullCOA);

    expect(fullResult.confidence).toBeGreaterThan(simpleResult.confidence);
  });
});
