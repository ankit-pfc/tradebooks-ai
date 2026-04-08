export type PipelineValidationCode =
  | 'E_CLASSIFICATION_AMBIGUOUS';

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
