/** Guard against a pathological self-referencing cause chain. */
const MAX_CAUSE_DEPTH = 4;

/**
 * A failure the Senti API reported, carrying the pieces of its error envelope
 * (`{ error: { code, message } }`) so callers can branch on status or code
 * without re-parsing a message string.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function textOf(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (value instanceof Error) return value.message.trim() || undefined;

  if (value && typeof value === 'object') {
    const record = value as { message?: unknown; code?: unknown };
    if (typeof record.message === 'string' && record.message.trim()) return record.message.trim();
    if (typeof record.code === 'string' && record.code.trim()) return record.code.trim();
  }

  return undefined;
}

/**
 * Render an error for a human, including its cause chain.
 *
 * `fetch` rejects with a bare "fetch failed" and puts the actual reason —
 * connect timeout, DNS failure, TLS error — in `cause`. Without this the tool
 * output tells the reader nothing they can act on.
 */
export function describeError(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;

  for (let depth = 0; depth < MAX_CAUSE_DEPTH && current !== undefined && current !== null; depth++) {
    const text = textOf(current);
    if (text && text !== parts[parts.length - 1]) parts.push(text);

    current = current instanceof Error ? current.cause : undefined;
  }

  return parts.length > 0 ? parts.join(': ') : String(error);
}
