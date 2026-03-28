import { describe, it, expect } from 'vitest';
import * as L from './ledger-names';

describe('ledger-names constants', () => {
  it('all charge ledgers have non-empty names and groups', () => {
    for (const def of L.ALL_CHARGE_LEDGERS) {
      expect(def.name).toBeTruthy();
      expect(def.group).toBeTruthy();
    }
  });

  it('investmentLedger produces correct format', () => {
    const def = L.investmentLedger('RELIANCE');
    expect(def.name).toBe('Investment in Equity Shares - RELIANCE');
    expect(def.group).toBe('Investments');
  });

  it('stockInTradeLedger produces correct format', () => {
    const def = L.stockInTradeLedger('TCS');
    expect(def.name).toBe('Shares-in-Trade - TCS');
    expect(def.group).toBe('Stock-in-Hand');
  });

  it('BROKER ledger is Sundry Creditors', () => {
    expect(L.BROKER.name).toBe('Zerodha Broking');
    expect(L.BROKER.group).toBe('Sundry Creditors');
  });

  it('STCG and LTCG ledgers exist for both profit and loss', () => {
    expect(L.STCG_PROFIT.name).toContain('Short Term');
    expect(L.LTCG_PROFIT.name).toContain('Long Term');
    expect(L.STCG_LOSS.name).toContain('Short Term');
    expect(L.LTCG_LOSS.name).toContain('Long Term');
  });

  it('no duplicate names in ALL_CHARGE_LEDGERS', () => {
    const names = L.ALL_CHARGE_LEDGERS.map((d) => d.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('pooled ledgers have correct groups', () => {
    expect(L.POOLED_INVESTMENT.group).toBe(L.INVESTMENT_GROUP);
    expect(L.POOLED_STOCK_IN_TRADE.group).toBe(L.STOCK_IN_TRADE_GROUP);
  });
});

describe('Capital Account constants', () => {
  it('CA_BROKER uses ZERODHA - KITE', () => {
    expect(L.CA_BROKER.name).toBe('ZERODHA - KITE');
    expect(L.CA_BROKER.group).toBe('Sundry Creditors');
  });

  it('caInvestmentLedger produces {symbol}-SH format', () => {
    const def = L.caInvestmentLedger('RELIANCE');
    expect(def.name).toBe('RELIANCE-SH');
    expect(def.group).toBe('INVESTMENT IN SHARES-ZERODHA');
  });

  it('caStcgLedger produces STCG ON {symbol} format', () => {
    const def = L.caStcgLedger('INFY');
    expect(def.name).toBe('STCG ON INFY');
    expect(def.group).toBe('STCG');
  });

  it('caLtcgLedger produces LTCG ON {symbol} format', () => {
    const def = L.caLtcgLedger('TCS');
    expect(def.name).toBe('LTCG ON TCS');
    expect(def.group).toBe('LTCG');
  });

  it('caStclLedger produces STCL ON {symbol} format', () => {
    const def = L.caStclLedger('WIPRO');
    expect(def.name).toBe('STCL ON WIPRO');
    expect(def.group).toBe('STCL');
  });

  it('caLtclLedger produces LTCL ON {symbol} format', () => {
    const def = L.caLtclLedger('SBIN');
    expect(def.name).toBe('LTCL ON SBIN');
    expect(def.group).toBe('LTCL');
  });

  it('caDividendLedger produces DIV {symbol} format', () => {
    const def = L.caDividendLedger('HDFC BANK');
    expect(def.name).toBe('DIV HDFC BANK');
    expect(def.group).toBe('Div on Shares');
  });

  it('charge ledgers are under Capital Account', () => {
    expect(L.CA_BROKERAGE.group).toBe('Capital Account');
    expect(L.CA_STT.group).toBe('Capital Account');
    expect(L.CA_DP_CHARGES.group).toBe('Capital Account');
    expect(L.CA_DEMAT_CHARGES.group).toBe('Capital Account');
  });

  it('charge ledger names match real Tally data', () => {
    expect(L.CA_BROKERAGE.name).toBe('SHARE BROKERAGE');
    expect(L.CA_STT.name).toBe('Stt');
    expect(L.CA_DP_CHARGES.name).toBe('DP Charges-Zerodha');
  });

  it('speculation ledgers are under Speculation Business', () => {
    expect(L.CA_SPECULATION_GAIN.group).toBe('Speculation Business');
    expect(L.CA_SPECULATION_LOSS.group).toBe('Speculation Business');
  });

  it('TDS ledgers exist', () => {
    expect(L.TDS_ON_DIVIDEND.name).toBe('TDS ON DIVIDEND');
    expect(L.TDS_ON_SECURITIES.name).toBe('TDS on Securities');
  });

  it('CA_CUSTOM_GROUPS covers all required sub-groups', () => {
    const groupNames = L.CA_CUSTOM_GROUPS.map((g) => g.name);
    expect(groupNames).toContain('STCG');
    expect(groupNames).toContain('LTCG');
    expect(groupNames).toContain('STCL');
    expect(groupNames).toContain('LTCL');
    expect(groupNames).toContain('Div on Shares');
    expect(groupNames).toContain('Speculation Business');
    expect(groupNames).toContain('INVESTMENT IN SHARES-ZERODHA');
  });

  it('all CA sub-groups have Capital Account or Investments as parent', () => {
    for (const g of L.CA_CUSTOM_GROUPS) {
      expect(['Capital Account', 'Investments']).toContain(g.parent);
    }
  });
});
