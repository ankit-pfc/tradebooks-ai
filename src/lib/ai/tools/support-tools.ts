import { tool } from 'ai';
import { z } from 'zod';

export interface SupportAgentContext {
  userId: string;
}

const productOverview = {
  product: 'TradeBooks AI',
  summary:
    'TradeBooks AI converts broker exports, currently Zerodha-first, into Tally-importable accounting output.',
  primaryUseCase:
    'It helps accountants and finance teams turn tradebook-led broker data into Tally XML artifacts with checks, warnings, batch history, and audit references.',
  v1Scope: [
    'Zerodha tradebook-led pipeline',
    'Optional funds statement, holdings, dividends, ledger, and contract note ingestion',
    'Real upload, process, export workflow',
    'Tally XML export artifacts',
    'Batch history and exceptions listing',
  ],
  currentLimits: [
    'Multi-broker support is not the current V1 focus.',
    'Advanced exception resolution and collaboration workflows are deferred.',
    'The batch-specific assistant should be used for questions about an uploaded batch.',
  ],
};

const workflowGuide = {
  steps: [
    {
      name: 'Upload',
      description:
        'Create a batch and upload Zerodha exports. Tradebook is the core file; supporting files improve checks and output quality.',
    },
    {
      name: 'Process',
      description:
        'TradeBooks detects file types, parses the uploaded files, builds canonical accounting events, runs reconciliation checks, and records warnings or exceptions.',
    },
    {
      name: 'Review',
      description:
        'Use batch history and exception details to see what was processed, what needs attention, and whether the batch is ready to export.',
    },
    {
      name: 'Export',
      description:
        'Download generated Tally XML output and import it into Tally using Tally import flows.',
    },
  ],
  importantDistinction:
    'The general support assistant explains the app. The batch assistant answers questions about a selected uploaded batch.',
};

const fileRequirements = {
  required: [
    {
      file: 'Zerodha tradebook CSV',
      reason: 'Primary source for trades and the tradebook-led pipeline.',
    },
  ],
  recommended: [
    {
      file: 'Contract notes',
      reason: 'Useful for validating charges, trade details, and reconciliation checks.',
    },
    {
      file: 'Funds statement or ledger',
      reason: 'Useful for cash movement checks and accounting completeness.',
    },
    {
      file: 'Holdings statement',
      reason: 'Useful for closing holdings and position context.',
    },
  ],
  optional: [
    {
      file: 'Dividends statement',
      reason: 'Useful when dividend accounting output is needed.',
    },
    {
      file: 'Tally chart of accounts or ledger master inputs',
      reason: 'Useful for mapping generated vouchers to the right Tally ledgers.',
    },
  ],
  note:
    'If supporting files are missing, TradeBooks may still process the tradebook but can surface warnings where data cannot be verified.',
};

const privacyAndStorage = {
  brokerAccess:
    'TradeBooks does not connect directly to Zerodha and does not ask for broker credentials. Users upload exported files.',
  tallyAccess:
    'TradeBooks does not connect directly to the user’s Tally database. It generates Tally XML artifacts for user-controlled import.',
  storage:
    'Uploaded files and generated artifacts are retained for batch history and audit traceability.',
  processingUse:
    'Uploaded data is used to parse broker exports, reconcile processing checks, build accounting events, and generate XML output.',
  auditTrail:
    'Batch results can point back to original uploaded files and source rows where the pipeline has that reference.',
};

const faq = [
  {
    question: 'Does TradeBooks connect to my Zerodha account?',
    answer:
      'No. The app is file-upload based. You export files from Zerodha and upload them to TradeBooks.',
  },
  {
    question: 'Does TradeBooks write directly into Tally?',
    answer:
      'No. It generates Tally XML output. You import that XML into Tally yourself.',
  },
  {
    question: 'Can I ask questions about a specific uploaded tradebook?',
    answer:
      'Yes, open the batch in History and use the batch Ask AI assistant. This support assistant is for product and workflow questions.',
  },
  {
    question: 'What happens if data is missing or mismatched?',
    answer:
      'The pipeline records warnings or exceptions so the user can review issues before relying on the export.',
  },
  {
    question: 'Is this tax or accounting advice?',
    answer:
      'No. TradeBooks explains generated output and processing checks, but filing or accounting treatment decisions should be reviewed with a qualified professional.',
  },
  {
    question: 'Which broker is supported first?',
    answer:
      'The current V1 scope is Zerodha-first. Multi-broker support is deferred.',
  },
];

export const supportAgentTools = {
  getProductOverview: tool({
    description: 'Get a concise overview of TradeBooks AI, its V1 scope, and current limits.',
    inputSchema: z.object({}),
    execute: async () => productOverview,
  }),

  getWorkflowGuide: tool({
    description: 'Get the user workflow for upload, processing, review, and Tally XML export.',
    inputSchema: z.object({}),
    execute: async () => workflowGuide,
  }),

  getFileRequirements: tool({
    description: 'Get required, recommended, and optional files for the Zerodha-first workflow.',
    inputSchema: z.object({}),
    execute: async () => fileRequirements,
  }),

  getPrivacyAndStorageInfo: tool({
    description:
      'Get information about broker access, Tally access, uploaded file retention, and audit traceability.',
    inputSchema: z.object({}),
    execute: async () => privacyAndStorage,
  }),

  getFrequentlyAskedQuestions: tool({
    description: 'Get common TradeBooks AI FAQ answers.',
    inputSchema: z.object({}),
    execute: async () => ({ faq }),
  }),
};
