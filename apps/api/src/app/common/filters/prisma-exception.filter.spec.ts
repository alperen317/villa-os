import { ArgumentsHost } from '@nestjs/common';
import { PrismaExceptionFilter } from './prisma-exception.filter';
import { Prisma } from '../../../generated/prisma/client';

/** Mirrors the shape the pg driver adapter actually produces (verified against Postgres 16). */
function driverAdapterError(originalCode: string) {
  return {
    modelName: 'Reservation',
    driverAdapterError: { name: 'DriverAdapterError', cause: { originalCode, kind: 'postgres' } },
  };
}

function prismaError(code: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError('internal detail that must not leak', {
    code,
    clientVersion: '7.9.1',
    meta,
  });
}

describe('PrismaExceptionFilter', () => {
  let filter: PrismaExceptionFilter;
  let json: jest.Mock;
  let status: jest.Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new PrismaExceptionFilter();
    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });
    host = {
      switchToHttp: () => ({ getResponse: () => ({ status }) }),
    } as unknown as ArgumentsHost;

    jest.spyOn(filter['logger'], 'error').mockImplementation(() => undefined);
  });

  it('maps an exclusion violation to 409 — the double-booking backstop', () => {
    // P2039 is generic; the SQLSTATE is what identifies the EXCLUDE constraint.
    filter.catch(prismaError('P2039', driverAdapterError('23P01')), host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        message: 'These dates conflict with an existing reservation for this villa/floor',
      }),
    );
  });

  it('maps a check violation to 400', () => {
    filter.catch(prismaError('P2039', driverAdapterError('23514')), host);

    expect(status).toHaveBeenCalledWith(400);
  });

  it('maps a unique violation to 409 and names the field', () => {
    filter.catch(prismaError('P2002', { target: ['username'] }), host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'A record with this username already exists' }),
    );
  });

  it('maps a missing record to 404', () => {
    filter.catch(prismaError('P2025'), host);

    expect(status).toHaveBeenCalledWith(404);
  });

  it('falls back to 500 for codes it does not recognise', () => {
    filter.catch(prismaError('P1001'), host);

    expect(status).toHaveBeenCalledWith(500);
  });

  it('never forwards Prisma’s own message to the client', () => {
    filter.catch(prismaError('P2039', driverAdapterError('23P01')), host);

    expect(json).not.toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('internal detail') }),
    );
  });
});
