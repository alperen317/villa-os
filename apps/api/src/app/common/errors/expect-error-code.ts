import { HttpException } from '@nestjs/common';
// Imported explicitly rather than relying on the ambient globals: this file is
// not named `*.spec.ts`, so tsconfig.app.json compiles it without jest's types.
import { expect } from '@jest/globals';
import { ErrorCode } from './error-codes';

/**
 * Test helper: asserts the failure a caller would actually see.
 *
 * Matching on the Nest exception class only proves the status family; the
 * `code` is what a client branches on, so that is what the tests pin.
 */
export function expectErrorCode(error: unknown, code: ErrorCode, status?: number): void {
  expect(error).toBeInstanceOf(HttpException);

  const exception = error as HttpException;
  expect(exception.getResponse()).toEqual(expect.objectContaining({ code }));

  if (status !== undefined) {
    expect(exception.getStatus()).toBe(status);
  }
}

/** `await expectRejectionCode(service.doThing(), ErrorCode.THING_NOT_FOUND, 404)` */
export async function expectRejectionCode(
  promise: Promise<unknown>,
  code: ErrorCode,
  status?: number,
): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(HttpException);
  await promise.catch((error: unknown) => expectErrorCode(error, code, status));
}
