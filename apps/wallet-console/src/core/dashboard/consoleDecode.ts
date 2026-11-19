/* Shared rules for the Console response decoders. A value that is missing or
   unknown never becomes a guessed good value, such as ACTIVE, a default kind or
   an amount of 0: the decoder shows it as unknown or refuses the response. */

/** The status of a row whose response has no status. */
export const CONSOLE_UNKNOWN_STATUS = 'UNKNOWN';

/** A Console response that does not match its contract. The page shows the message. */
export class ConsoleDecodeError extends Error {
  constructor(field: string, value: unknown) {
    super(
      value === undefined || value === null || value === ''
        ? `The Console response has no ${field}`
        : `The Console response has an unknown ${field}: ${JSON.stringify(value)}`,
    );
    this.name = 'ConsoleDecodeError';
  }
}

/**
 * The status as the server sent it. A missing status is `UNKNOWN`, so a list
 * still renders and a row never shows as `ACTIVE` unless the server said so.
 */
export function decodeConsoleStatus(raw: unknown): string {
  const value = typeof raw === 'string' ? raw.trim() : '';
  return value || CONSOLE_UNKNOWN_STATUS;
}

/** One value of a closed set. A missing or unknown value is a decode error. */
export function decodeConsoleEnum<T extends string>(
  raw: unknown,
  allowed: readonly T[],
  field: string,
): T {
  const value = typeof raw === 'string' ? raw.trim() : '';
  const match = allowed.find((candidate) => candidate === value);
  if (match === undefined) throw new ConsoleDecodeError(field, raw);
  return match;
}

/** A whole number of minor units (cents). A missing or bad amount is a decode error, never 0. */
export function decodeConsoleMinorAmount(raw: unknown, field: string): number {
  if (typeof raw !== 'number' || !Number.isSafeInteger(raw)) {
    throw new ConsoleDecodeError(field, raw);
  }
  return raw;
}
