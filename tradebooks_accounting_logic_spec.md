# TradeBooks AI — Accounting Logic Specification
> For Claude Code: This file defines the core accounting and tax rules to verify and implement.
> Source: CA-reviewed document for Zerodha trade book processing.

---

## 1. TRADE CLASSIFICATION (Primary Router)

Every trade must first be classified using the `product` column from the Zerodha trade book.

| Zerodha Marker | Trade Type        | Tax Category                   | Income Type             |
|----------------|-------------------|--------------------------------|-------------------------|
| CNC            | Delivery          | Investment (STCG / LTCG)       | Capital Gains           |
| MIS            | Intraday          | Speculative Business Income    | Business Income         |
| NRML (Equity)  | Carry Forward     | Non-Speculative Business Income| Business Income         |
| NRML (F&O)     | Futures / Options | Non-Speculative Business Income| Business Income         |
| MTF            | Delivery (leveraged) | Investment OR Business (case-based) | Capital Gains / Business |
| MCX / Commodity (any marker) | Commodity Derivative | Non-Speculative Business Income | Business Income |

> ⚠️ COMMODITY OVERRIDE RULE: All commodity trades (MCX exchange) are ALWAYS Non-Speculative Business Income — regardless of MIS or NRML marker. There is no delivery/investment concept in commodities.

> ⚠️ MTF AMBIGUITY: MTF trades default to Investment (CNC-like). Interest paid on MTF borrowed funds = deductible expense ONLY if classified as Business.

---

## 2. CHARGE TREATMENT BY TRADE TYPE

Six charge types are levied on every trade. Treatment differs based on classification:

| Charge                       | Investment (CNC)                            | Business Income (MIS / NRML / F&O / Commodity) |
|------------------------------|---------------------------------------------|--------------------------------------------------|
| Brokerage                    | Add to Buy cost / Reduce from Sale proceeds | Fully deductible P&L expense                    |
| Exchange Transaction Charges | Add to Buy cost / Reduce from Sale proceeds | Fully deductible P&L expense                    |
| GST                          | Add to Buy cost / Reduce from Sale proceeds | Fully deductible P&L expense                    |
| SEBI Charges                 | Add to Buy cost / Reduce from Sale proceeds | Fully deductible P&L expense                    |
| Stamp Duty (Buy side only)   | Add to Buy cost only (no sell-side stamp)   | Fully deductible P&L expense                    |
| **STT**                      | **NOT deductible — goes to Capital A/c**    | **NOT deductible — NOT a P&L expense**          |

> ⚠️ STT EXCEPTION: STT is never deductible in either category. Do not include it in cost basis or expense ledger.

> ⚠️ STAMP DUTY: Only charged on the buy leg. No stamp duty on sell transactions.

---

## 3. ACCOUNTING ENTRIES — INVESTMENT (CNC)

### 3a. Purchase Entry

```
Share / Scrip Account                   DR   [Net Buy Price + Brokerage + ETCharges + GST + SEBI + Stamp Duty]
    To Zerodha Ledger Account           CR   [Same amount]
```
- Inventory (stock ledger) increases by qty purchased
- Cost per unit = (Total DR amount) / qty
- STT is excluded from this computation — post separately to Capital Account

### 3b. Sale Entry

```
Zerodha Ledger Account                  DR   [Net Sale Price − Brokerage − ETCharges − GST − SEBI]
ST/LT Capital Loss Account              DR   [If sale price < purchase price — goes to Capital Account]
    To Share / Scrip Account            CR   [FIFO cost of units sold]
    To ST/LT Capital Gain Account       CR   [If sale price > purchase price — goes to Capital Account]
```
- Inventory decreases by qty sold using **FIFO method**
- Gain/Loss = Net Sale Proceeds − FIFO Cost Basis
- Capital Gain/Loss goes to Capital Account, NOT P&L

### 3c. Holding Period Logic (for STCG vs LTCG)

```
Holding period = Sale Date − FIFO Purchase Date (of specific lot sold)

If holding_days < 365:
    → Short-Term Capital Gain (STCG)
    → Tax rate: 15%

If holding_days >= 365:
    → Long-Term Capital Gain (LTCG)
    → Exemption: First ₹1,00,000 of LTCG is tax-free
    → Above ₹1L: Tax rate 10% (no indexation benefit)
```

---

## 4. ACCOUNTING ENTRIES — BUSINESS INCOME (MIS / NRML / F&O)

### 4a. Purchase Entry

```
Trade / Position Account                DR   [Gross Buy Price only — no charges baked in]
    To Zerodha Ledger Account           CR   [Same]

Expense Accounts (separate entries):
    Brokerage Expense                   DR
    Exchange Transaction Charges Exp    DR
    GST Expense                         DR
    SEBI Charges Expense                DR
    Stamp Duty Expense                  DR
        To Zerodha Ledger Account       CR   [Corresponding credit for each]
```

### 4b. Sale Entry

```
Zerodha Ledger Account                  DR   [Gross Sale Price]
    To Trade / Position Account         CR   [Original Buy Price]
    To Trading Profit (P&L)             CR   [If profit]

Trading Loss (P&L)                      DR   [If loss]
    To Trade / Position Account         CR
```
- All charges on sale side also posted to respective Expense accounts
- STT is NOT posted as an expense — exclude entirely

### 4c. P&L and Set-Off Rules

```
Intraday (MIS) income type = Speculative Business Income
    → Intraday losses can ONLY be set off against Intraday profits
    → Cannot offset against F&O, salary, or other income
    → Carry forward: up to 4 years

F&O / NRML income type = Non-Speculative Business Income
    → F&O losses can be set off against ANY income EXCEPT salary
    → Carry forward: up to 8 years

Commodity (MCX) = Non-Speculative Business Income (same rules as F&O)
```

---

## 5. ZERODHA LEDGER ACCOUNT BEHAVIOR

- The Zerodha Ledger Account acts as a **broker/creditor account**
- All buy-side debits and sell-side credits flow through it
- The running balance in the system must reconcile with the Zerodha-provided ledger balance
- This account can be classified under: Investment Ledger OR Sundry Creditors (depending on firm's COA preference)

---

## 6. INVENTORY / COST BASIS METHOD

- Method: **FIFO (First In, First Out)** — mandatory
- On each sell transaction, identify the oldest unmatched buy lot for that scrip
- Partial lot sales are supported — split the lot and carry forward the remainder
- Qty and cost basis must update atomically on every transaction

---

## 7. IMPLEMENTATION CHECKLIST FOR CLAUDE CODE

- [ ] Trade classifier reads `product` column → routes to Investment or Business path
- [ ] Commodity override: MCX exchange always → Non-Speculative Business
- [ ] Charge splitter: STT excluded from all cost/expense calculations
- [ ] Stamp Duty: only on buy side transactions
- [ ] Investment path: charges baked into cost basis per unit
- [ ] Business path: charges posted as separate P&L expense line items
- [ ] FIFO engine: lot tracking per scrip with partial lot support
- [ ] Holding period calculator: per FIFO lot, in days
- [ ] STCG/LTCG classifier: < 365 days vs >= 365 days
- [ ] LTCG exemption logic: first ₹1,00,000 tax-free
- [ ] Capital Account vs P&L routing: gains/losses go to correct ledger
- [ ] Zerodha ledger reconciliation: system balance vs broker statement
- [ ] Set-off rules enforced: Speculative vs Non-Speculative loss buckets kept separate
- [ ] MTF handling: flag for manual classification or default to Investment

---

## 8. EDGE CASES TO HANDLE

1. **Same-day buy + sell on CNC** → System should flag this; technically delivery but same-day behavior differs
2. **F&O expiry** → Settlement entry on expiry date if position not squared off
3. **Bonus / Split shares** → Cost basis must recompute; FIFO lots must adjust qty and price
4. **Partial lot FIFO sell** → Remaining lot carries forward with original buy date intact
5. **MTF interest** → Separate expense line; only deductible if trade classified as Business
6. **STT posting** → Should appear in the trade data but must be silently excluded from all accounting entries

---

*End of specification. All rules sourced from CA-reviewed Zerodha accounting document.*
