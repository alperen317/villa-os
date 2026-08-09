import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from './error-codes';

/**
 * An HttpException whose body always carries a machine-readable `code`
 * alongside the human-readable `message`, so a client can localise the wording
 * without parsing prose. `details` carries the extra facts a screen needs —
 * the conflicting reservation's id, the current `updatedAt` after a stale
 * write — which used to be spread ad hoc across each exception's body.
 */
export abstract class DomainException extends HttpException {
  protected constructor(
    status: HttpStatus,
    code: ErrorCode,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super({ statusCode: status, error: HttpStatus[status], code, message, ...details }, status);
  }
}

/**
 * For failures that do not warrant a named class of their own — mostly "this id
 * does not exist" and one-off validation rules.
 */
export class AppException extends DomainException {
  constructor(
    status: HttpStatus,
    code: ErrorCode,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(status, code, message, details);
  }
}
