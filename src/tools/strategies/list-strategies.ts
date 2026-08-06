import * as z from 'zod/v4';
import { parseOrThrow } from '../../core/parse.js';

const PresetSchema = z.object({
  id: z.string(),
  name: z.string(),
});

/**
 * Transcribed from `GET /api/v1/strategies` in the live OpenAPI document.
 *
 * `description`, `supportedSymbols` and `supportedTimeframes` are absent from
 * the endpoint's `required` array — they are optional, not merely nullable. A
 * schema marking them only `.nullable()` would reject a response that omits
 * them, which the API is entitled to send.
 */
export const StrategySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  isActive: z.boolean(),
  supportedSymbols: z.array(z.string()).optional(),
  supportedTimeframes: z.array(z.string()).optional(),
  avgRating: z.number().nullable(),
  reviewCount: z.number().int(),
  presets: z.array(PresetSchema),
});

export type Strategy = z.infer<typeof StrategySchema>;

export const StrategiesOutputSchema = z.object({
  strategies: z.array(StrategySchema),
});

export function parseStrategies(payload: unknown): Strategy[] {
  return parseOrThrow(z.array(StrategySchema), payload, 'strategy list');
}

/** A null rating renders as this, never as `0` — no reviews is not a bad score. */
const NO_VALUE = '—';

function block(strategy: Strategy): string {
  const rating =
    strategy.avgRating === null
      ? `rating ${NO_VALUE}`
      : `rating ${strategy.avgRating} (${strategy.reviewCount} reviews)`;
  const state = strategy.isActive ? 'active' : 'inactive';

  const lines = [
    `- ${strategy.name} (strategyId ${strategy.id}) — ${state} · ${rating}`,
  ];

  if (strategy.description) lines.push(`  ${strategy.description}`);
  if (strategy.supportedSymbols?.length) {
    lines.push(`  symbols: ${strategy.supportedSymbols.join(', ')}`);
  }
  if (strategy.supportedTimeframes?.length) {
    lines.push(`  timeframes: ${strategy.supportedTimeframes.join(', ')}`);
  }
  if (strategy.presets.length > 0) {
    lines.push(
      `  presets: ${strategy.presets.map((preset) => `${preset.name} [id ${preset.id}]`).join(', ')}`,
    );
  }

  return lines.join('\n');
}

export function formatStrategies(strategies: Strategy[]): string {
  if (strategies.length === 0) {
    return (
      'No active strategies in the Senti catalog. This is a platform-wide list, so an ' +
      'empty result points at the service rather than at this API key.'
    );
  }

  const noun = strategies.length === 1 ? 'strategy' : 'strategies';
  const blocks = strategies.map(block).join('\n\n');

  return (
    `${strategies.length} ${noun} in the platform-wide Senti catalog — these are the ` +
    'strategies available to deploy, NOT the ones currently running on an account. For ' +
    'that, use list_account_strategies.\n\n' +
    blocks
  );
}
