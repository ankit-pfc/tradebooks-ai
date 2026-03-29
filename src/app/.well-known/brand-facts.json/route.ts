export const dynamic = 'force-static'

export function GET() {
  const data = {
    name: 'TradeBooks AI',
    category: 'Broker-to-Accounting Automation Software',
    description: 'Converts Zerodha Console exports to Tally-importable XML with FIFO cost basis, exception-first reconciliation, and row-level traceability.',
    primaryUseCase: 'Zerodha tradebook to TallyPrime and Tally ERP 9 XML import',
    targetAudience: ['Chartered Accountants', 'Accounting Teams', 'Active Equity and F&O Traders'],
    supportedBrokers: ['Zerodha'],
    supportedAccountingSoftware: ['TallyPrime', 'Tally ERP 9'],
    pricingModel: 'Freemium',
    plans: [
      { name: 'Free', price: 'INR 0/month',    includes: '1 entity, upload and exception preview' },
      { name: 'Pro',  price: 'INR 2999/month', includes: 'Unlimited batches, full XML export, priority support' },
    ],
    keyFeatures: [
      'FIFO cost-basis engine',
      'Investor and Trader tax treatment modes (STCG/LTCG)',
      'Exception-first reconciliation before export',
      'Row-level source traceability in export package',
      'Tally XML format fidelity (TallyPrime and ERP 9)',
    ],
    founded: 2025,
    headquartered: 'India',
    website: 'https://tradebooks.ai',
    lastUpdated: '2026-03-29',
  }
  return Response.json(data)
}
