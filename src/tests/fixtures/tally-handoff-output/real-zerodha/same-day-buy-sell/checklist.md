# same-day-buy-sell Tally Import Checklist

- Masters that must exist first: broker ledger, stock item(s), UOM NOS/Numbers and SH/Share, charge ledgers, and gain/loss ledgers.
- Voucher type used: Journal.
- Why that voucher type is correct: delivery equity trades use Journal vouchers so inventory allocations and gain/loss can be posted without switching to invoice-style vouchers.
- Sign conventions used: debits are negative amounts in XML, credits are positive amounts; inventory quantities are always unsigned, and stock-in/stock-out direction comes from the parent ledger line.
- Quantity/date/rate formatting: dates are YYYYMMDD, quantities carry the SH unit, and rates are written as rate/SH.
- Representative voucher lines:
DR:ZERODHA - KITE:23.06
DR:Stt:0.45
CR:Intraday Gain on Sale of Shares - ZERODHA:23.51
- Included notes: CN-SAME-DAY.