# same-day-buy-sell Tally Import Checklist

- Masters that must exist first: broker ledger, stock item(s), UOM SH, charge ledgers, and gain/loss ledgers.
- Voucher type used: Purchase, Sales, Journal.
- Why that voucher type is correct: delivery equity trades use Journal vouchers so inventory allocations and gain/loss can be posted without switching to invoice-style vouchers.
- Sign conventions used: debits are negative amounts in XML, credits are positive amounts; purchase inventory quantities are positive, sale inventory quantities are negative.
- Quantity/date/rate formatting: dates are YYYYMMDD, quantities carry the SH unit, and rates are written as rate/SH.
- Representative voucher lines:
DR:VISHAL-X-SH:19416.65
CR:ZERODHA - KITE:19416.65
- Included notes: CNT-24/25-103858427.