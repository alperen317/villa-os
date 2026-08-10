import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '../../../generated/prisma/client';

/**
 * Turns database constraint violations into the status codes they mean.
 *
 * Without this every violation is a 500, which matters most for the
 * `reservations_no_overlap_per_unit` EXCLUDE constraint: it is the backstop that
 * catches a double-booking the service-layer check raced past, so the caller
 * needs the same 409 it would have received had the check caught it.
 *
 * Prisma reports exclusion and check violations under the same generic P2039,
 * so they are told apart by the Postgres SQLSTATE the driver adapter carries.
 */
const EXCLUSION_VIOLATION = '23P01';
const CHECK_VIOLATION = '23514';

interface Translation {
  status: number;
  message: string;
  error: string;
}

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    const { status, message, error } = this.translate(exception);

    // Prisma's own message embeds the failing query and the source location it
    // was called from; that goes to the log, never to the client.
    this.logger.error(`Prisma ${exception.code} -> HTTP ${status}: ${exception.message}`);

    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ statusCode: status, message, error });
  }

  private translate(exception: Prisma.PrismaClientKnownRequestError): Translation {
    switch (this.sqlState(exception)) {
      case EXCLUSION_VIOLATION:
        return {
          status: HttpStatus.CONFLICT,
          message: 'These dates conflict with an existing reservation for this villa/floor',
          error: 'Conflict',
        };
      case CHECK_VIOLATION:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'The submitted values are not a valid combination',
          error: 'Bad Request',
        };
    }

    switch (exception.code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          message: this.uniqueMessage(exception),
          error: 'Conflict',
        };
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'This refers to a record that does not exist',
          error: 'Bad Request',
        };
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'The requested record no longer exists',
          error: 'Not Found',
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
          error: 'Internal Server Error',
        };
    }
  }

  /** The Postgres SQLSTATE, which the pg driver adapter nests inside `meta`. */
  private sqlState(exception: Prisma.PrismaClientKnownRequestError): string | undefined {
    const cause = (
      exception.meta as { driverAdapterError?: { cause?: { originalCode?: unknown } } } | undefined
    )?.driverAdapterError?.cause;

    return typeof cause?.originalCode === 'string' ? cause.originalCode : undefined;
  }

  private uniqueMessage(exception: Prisma.PrismaClientKnownRequestError): string {
    const target = (exception.meta as { target?: unknown } | undefined)?.target;
    const fields = Array.isArray(target)
      ? target.filter((field): field is string => typeof field === 'string')
      : [];

    return fields.length > 0
      ? `A record with this ${fields.join(', ')} already exists`
      : 'A record with these values already exists';
  }
}
