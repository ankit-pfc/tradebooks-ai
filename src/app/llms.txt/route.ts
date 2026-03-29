export const dynamic = 'force-static'

export function GET() {
  const content = `# TradeBooks AI

> TradeBooks AI converts Zerodha broker export files (tradebook, funds statement, holdings, contract notes) into Tally-importable XML. It applies FIFO cost-basis accounting, supports Investor and Trader tax treatments (STCG/LTCG), flags reconciliation exceptions before export, and produces row-level traceable Tally vouchers. Built for Indian Chartered Accountants, accounting teams, and active traders.

## Core Product
- [How It Works](https://tradebooks.ai/#how-it-works)
- [Pricing](https://tradebooks.ai/pricing)
- [Brand Facts](https://tradebooks.ai/brand-facts)

## Accounting Guides
- [How to Import Zerodha Trades into Tally](https://tradebooks.ai/guides/zerodha-tally-accounting)
- [F&O Tax Audit Guide for Indian Traders](https://tradebooks.ai/guides/f-and-o-tax-audit-india)
- [Tax Loss Harvesting in Demat Accounts](https://tradebooks.ai/guides/tax-loss-harvesting-demat-accounts)

## Legal
- [Privacy Policy](https://tradebooks.ai/privacy)
- [Terms of Service](https://tradebooks.ai/terms)
`
  return new Response(content, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
