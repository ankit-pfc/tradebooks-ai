/**
 * reconciliation/index.ts
 * Public surface for the reconciliation engine.
 * Re-exports all checks, exception detection utilities, and their types.
 */

export {
  // Individual checks
  checkTradeTotals,
  checkVoucherBalance,
  checkHoldingsReconciliation,
  checkDuplicateEvents,
  checkChargeCompleteness,
  // Aggregate runner
  runFullReconciliation,
  // Types
  type ReconciliationCheck,
  type ReconciliationResult,
} from './checks';

export {
  detectExceptions,
  // Type
  type DetectedException,
} from './exceptions';
