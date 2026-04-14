export type PipelineValidationCode =
  | 'E_CLASSIFICATION_AMBIGUOUS'
  | 'E_INVESTOR_TRADE_MUST_BE_JOURNAL'
  | 'E_INTRADAY_EMPTY_GROUP'
  | 'E_INVALID_DATE'
  | 'E_INVALID_QUANTITY'
  | 'E_INVALID_PRICE'
  | 'E_INVALID_TRADE_TYPE';

export class PipelineValidationError extends Error {
  readonly code: PipelineValidationCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: PipelineValidationCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'PipelineValidationError';
    this.code = code;
    this.details = details;
  }
}

export function isPipelineValidationError(
  value: unknown,
): value is PipelineValidationError {
  return value instanceof PipelineValidationError;
}
