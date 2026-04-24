# same-day-buy-sell Tally Import Checklist

- Masters that must exist first: broker ledger, stock item(s), UOM NOS, charge ledgers, and gain/loss ledgers.
- Voucher type used: Journal.
- Why that voucher type is correct: delivery equity trades use Journal vouchers so inventory allocations and gain/loss can be posted without switching to invoice-style vouchers.
- Sign conventions used: debits are negative amounts in XML, credits are positive amounts; purchase inventory quantities are positive, sale inventory quantities are negative.
- Quantity/date/rate formatting: dates are YYYYMMDD, quantities carry the NOS unit, and rates are written as rate/NOS.
- Representative voucher lines:
DR:ZERODHA - KITE:23.06
DR:Stt:0.45
CR:Intraday Gain on Sale of Shares - ZERODHA:23.51
- Included notes: CN-SAME-DAY.