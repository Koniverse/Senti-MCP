import type * as z from 'zod/v4';

/**
 * Validate a payload against a schema, or throw an error naming the field that
 * failed and what a reader should do about it.
 *
 * Validation is all-or-nothing by choice: one malformed field fails the whole
 * response rather than passing malformed data to the model. The operational
 * cost is real — a single upstream field change takes down a whole tool rather
 * than one row — and that trade is right while a tool returns records a human
 * is about to act on financially. When it stops being right, the fix is
 * per-item partial parsing that keeps the valid rows and reports the rejected
 * ones, not a looser schema, which would reintroduce exactly the silent
 * corruption this guards against.
 *
 * `subject` names what failed to parse, in the caller's words — "account list",
 * "position list". It is the only thing that varies between call sites, which
 * is why they call this rather than each carrying a copy of the block.
 */
export function parseOrThrow<T>(schema: z.ZodType<T>, payload: unknown, subject: string): T {
  const result = schema.safeParse(payload);

  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue && issue.path.length > 0 ? issue.path.join('.') : '(root)';

    throw new Error(
      `Senti API returned an unexpected shape for the ${subject} at "${where}": ` +
        `${issue?.message ?? 'unknown issue'}. The API may have changed; ` +
        'senti-mcp-server needs updating.',
    );
  }

  return result.data;
}
