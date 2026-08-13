import { describe, expect, test } from 'vitest';
import {
  downsample,
  MAX_POINTS,
  parseTimeseries,
  formatTimeseries,
  shapeTimeseries,
  type Timeseries,
  type TimeseriesPoint,
} from './timeseries.js';

const START_MS = Date.UTC(2026, 6, 1);
const MINUTE_MS = 60_000;

/**
 * The index of the deepest drawdown in {@link LONG_SERIES}, and the reason this
 * fixture exists.
 *
 * 1000 points cut to 200 is a stride of 5, so a naive "every Nth point"
 * implementation samples 0, 5, 10 … 995: it drops index 498 and it drops the
 * final point at 999. Both are what AC-4 pins. 498 is also missed by an evenly
 * spaced sample over `[0, 999]` — `Math.round(i × 999 / 199)` produces 497 and
 * 502 either side of it and never 498 — so the trough survives only if
 * something puts it back deliberately. A fixture whose trough happened to land
 * on a stride boundary would pass against the very implementation AC-4 exists
 * to reject.
 */
const TROUGH = 498;
const SERIES_LENGTH = 1000;

const point = (index: number, drawdownPct: number): TimeseriesPoint => ({
  timeMs: START_MS + index * MINUTE_MS,
  balance: 10_000,
  equity: 10_000 - drawdownPct * 100,
  drawdownPct,
});

/** Shallow everywhere (0 → 3%) except the trough, which is unambiguous. */
const shallow = (index: number) => (index % 7) * 0.5;

const LONG_SERIES: TimeseriesPoint[] = Array.from({ length: SERIES_LENGTH }, (_, index) =>
  point(index, index === TROUGH ? 42.5 : shallow(index)),
);

const indexOfTime = (candidate: TimeseriesPoint) => (candidate.timeMs - START_MS) / MINUTE_MS;

/** The one login this account holds — and a string that must never be returned. */
const LOGIN = '413878201';

const CLEAN = {
  equityUnavailable: false,
  drawdownUnavailable: false,
  balanceOnly: false,
  isSoftDeleted: false,
};

/** A response shaped exactly as the live OpenAPI document declares it. */
const RESPONSE: Timeseries = {
  portfolio: LONG_SERIES,
  perAccount: { [LOGIN]: LONG_SERIES },
  caveats: { [LOGIN]: { ...CLEAN, balanceOnly: true } },
  portfolioCaveats: { ...CLEAN, drawdownUnavailable: true },
};

describe('parseTimeseries', () => {
  test('accepts a live-shaped payload', () => {
    expect(() => parseTimeseries(RESPONSE)).not.toThrow();
  });

  test('names the field and the subject when the API changes shape', () => {
    const broken = {
      ...RESPONSE,
      portfolio: [{ ...LONG_SERIES[0], drawdownPct: 'deep' }],
    };

    expect(() => parseTimeseries(broken)).toThrow(
      /equity timeseries at "portfolio\.0\.drawdownPct"/,
    );
  });

  test('rejects a portfolio point that is missing a member', () => {
    const broken = { ...RESPONSE, portfolio: [{ timeMs: 1, balance: 2, equity: 3 }] };

    expect(() => parseTimeseries(broken)).toThrow(/equity timeseries at "portfolio\.0/);
  });

  test('rejects a caveat block whose flags changed type', () => {
    const broken = { ...RESPONSE, portfolioCaveats: { ...CLEAN, balanceOnly: 'yes' } };

    expect(() => parseTimeseries(broken)).toThrow(
      /equity timeseries at "portfolioCaveats\.balanceOnly"/,
    );
  });

  test('does not reject a response whose perAccount block changed shape', () => {
    // The one block this tool drops whole, so its shape can never reach the
    // model. Validating it would turn an upstream change in data nobody reads
    // into an outage for the data everybody does — `breakdowns.ts` makes the
    // same trade for the same block.
    expect(() => parseTimeseries({ ...RESPONSE, perAccount: { somethingNew: 1 } })).not.toThrow();
  });
});

describe('downsample', () => {
  test('returns a series shorter than the cap unmodified', () => {
    const short = LONG_SERIES.slice(0, 30);

    expect(downsample(short, MAX_POINTS)).toBe(short);
  });

  test('returns a series exactly at the cap unmodified', () => {
    const exact = LONG_SERIES.slice(0, MAX_POINTS);

    expect(downsample(exact, MAX_POINTS)).toBe(exact);
  });

  test('caps a longer series at the maximum', () => {
    expect(downsample(LONG_SERIES, MAX_POINTS)).toHaveLength(MAX_POINTS);
  });

  test('keeps the first point', () => {
    expect(downsample(LONG_SERIES, MAX_POINTS)[0]).toBe(LONG_SERIES[0]);
  });

  test('keeps the last point, which a stride of 5 over 1000 points would drop', () => {
    const kept = downsample(LONG_SERIES, MAX_POINTS);

    expect(kept[kept.length - 1]).toBe(LONG_SERIES[SERIES_LENGTH - 1]);
  });

  test('keeps the deepest drawdown when it falls between two sampling strides', () => {
    expect(downsample(LONG_SERIES, MAX_POINTS)).toContain(LONG_SERIES[TROUGH]);
  });

  test('finds the deepest drawdown by magnitude, whichever sign the API uses', () => {
    const negative = LONG_SERIES.map((entry) => ({ ...entry, drawdownPct: -entry.drawdownPct }));

    const kept = downsample(negative, MAX_POINTS);

    expect(kept.map(indexOfTime)).toContain(TROUGH);
  });

  test('returns the points in their original order', () => {
    const times = downsample(LONG_SERIES, MAX_POINTS).map((entry) => entry.timeMs);

    expect(times).toEqual([...times].sort((left, right) => left - right));
  });

  test('returns real observations — no point is interpolated or synthesized', () => {
    const source = new Set<TimeseriesPoint>(LONG_SERIES);

    for (const kept of downsample(LONG_SERIES, MAX_POINTS)) expect(source.has(kept)).toBe(true);
  });

  test('returns no point twice, even though three are pinned', () => {
    const kept = downsample(LONG_SERIES, MAX_POINTS);

    expect(new Set(kept).size).toBe(kept.length);
  });

  test('samples the remainder evenly rather than clustering around the pins', () => {
    const indices = downsample(LONG_SERIES, MAX_POINTS).map(indexOfTime);
    const gaps = indices.slice(1).map((index, position) => index - (indices[position] ?? 0));

    // An even sample of 200 from 1000 steps by ~5. The trough's insertion
    // perturbs one neighbourhood; nothing else may drift far from the stride.
    expect(Math.max(...gaps)).toBeLessThanOrEqual(10);
    expect(Math.min(...gaps)).toBeGreaterThan(0);
  });

  test('honours a cap that leaves barely room for the three pinned points', () => {
    const kept = downsample(LONG_SERIES, 3);

    expect(kept).toHaveLength(3);
    expect(kept).toEqual([LONG_SERIES[0], LONG_SERIES[TROUGH], LONG_SERIES[SERIES_LENGTH - 1]]);
  });

  test('keeps the trough when it is itself the first or the last point', () => {
    const troughFirst = [point(0, 60), ...LONG_SERIES.slice(1, 400).map((entry) => ({ ...entry }))];

    const kept = downsample(troughFirst, 10);

    expect(kept[0]).toBe(troughFirst[0]);
    expect(kept).toHaveLength(10);
  });
});

/** Short enough that nothing is cut — the other half of AC-5. */
const SHORT_SERIES = LONG_SERIES.slice(0, 40);

const SHORT_RESPONSE: Timeseries = { ...RESPONSE, portfolio: SHORT_SERIES };

const shaped = () => shapeTimeseries(RESPONSE);
const shapedShort = () => shapeTimeseries(SHORT_RESPONSE);

describe('the perAccount cut', () => {
  test('drops the block from the structured output entirely', () => {
    expect(shaped()).not.toHaveProperty('perAccount');
    expect(Object.keys(shaped())).toEqual([
      'portfolio',
      'caveats',
      'portfolioCaveats',
      'notes',
    ]);
  });

  test('leaves no note, because the block restated the series that is still here', () => {
    expect(shapedShort().notes).toEqual([]);
  });
});

describe('the downsample cut', () => {
  test('caps the portfolio at MAX_POINTS', () => {
    expect(shaped().portfolio).toHaveLength(MAX_POINTS);
  });

  test('keeps the first point, the last point and the deepest drawdown', () => {
    const kept = shaped().portfolio;

    expect(kept[0]).toBe(LONG_SERIES[0]);
    expect(kept[kept.length - 1]).toBe(LONG_SERIES[SERIES_LENGTH - 1]);
    expect(kept).toContain(LONG_SERIES[TROUGH]);
  });

  test('states how many points the API held and how many remain', () => {
    const note = shaped().notes.join(' ');

    expect(note).toContain('1,000');
    expect(note).toContain('200');
  });

  test('states that the extremes survived the cut', () => {
    const note = shaped().notes.join(' ');

    expect(note).toMatch(/first/i);
    expect(note).toMatch(/last/i);
    expect(note).toMatch(/deepest drawdown/i);
  });

  test('tells the reader how to get finer resolution, and that there is no escape hatch', () => {
    const note = shaped().notes.join(' ');

    expect(note).toMatch(/from.*to|narrow/i);
    expect(note).toMatch(/no option/i);
  });

  test('emits exactly one note — the downsample is the only lossy cut', () => {
    expect(shaped().notes).toHaveLength(1);
  });
});

describe('a series at or under the cap', () => {
  test('passes the portfolio through unmodified', () => {
    expect(shapedShort().portfolio).toBe(SHORT_SERIES);
  });

  test('emits no note for a downsample that did not happen', () => {
    expect(shapedShort().notes).toEqual([]);
  });
});

describe('caveats', () => {
  test('returns portfolioCaveats in full, exactly as the API stated them', () => {
    expect(shaped().portfolioCaveats).toEqual(RESPONSE.portfolioCaveats);
    expect(shapedShort().portfolioCaveats).toEqual(RESPONSE.portfolioCaveats);
  });

  test('returns the per-account caveats in full, never summarized', () => {
    expect(shaped().caveats).toEqual(RESPONSE.caveats);
  });

  test('leaves them untouched even on the response that was most heavily cut', () => {
    // AC-7's point: whatever else shaping removes, the API's own qualification
    // of its numbers is never what gets shortened.
    expect(shaped().caveats[LOGIN]).toEqual({ ...CLEAN, balanceOnly: true });
  });
});

const WINDOW = { from: '2026-07-01', to: '2026-07-03', reporting: 'EUR' };

const rendered = () => formatTimeseries(shaped(), WINDOW);

describe('formatTimeseries', () => {
  test('states the window and the reporting currency', () => {
    expect(rendered()).toContain('2026-07-01 → 2026-07-03');
    expect(rendered()).toContain('EUR');
  });

  test('names the API default currency when reporting was omitted', () => {
    expect(formatTimeseries(shaped(), { from: '2026-07-01' })).toContain('USD');
  });

  test('reports how many points the answer holds', () => {
    expect(rendered()).toContain('200');
  });

  test('reports where the series started and where it ended', () => {
    expect(rendered()).toMatch(/started/i);
    expect(rendered()).toMatch(/ended/i);
  });

  test('reports the deepest drawdown and the day it happened', () => {
    expect(rendered()).toContain('42.50%');
    expect(rendered()).toContain('2026-07-01');
  });

  test('carries every note into the text, where a host that shows content alone will see it', () => {
    for (const note of shaped().notes) expect(rendered()).toContain(note);
  });

  test('states the portfolio caveat rather than quoting the figures unqualified', () => {
    // The API said it could not reconstruct drawdown. A tool that prints the
    // curve and drops that sentence is why a model would state the number
    // without hedging it.
    expect(rendered()).toMatch(/drawdown/i);
    expect(rendered()).toMatch(/could not be reconstructed|unavailable/i);
  });

  test('states the per-account caveat in full too', () => {
    expect(rendered()).toContain(LOGIN);
    expect(rendered()).toMatch(/balance/i);
  });

  test('says so plainly when the API flagged nothing', () => {
    const clean = shapeTimeseries({ ...RESPONSE, caveats: {}, portfolioCaveats: CLEAN });

    expect(formatTimeseries(clean, WINDOW)).toMatch(/no caveat|nothing flagged|none/i);
  });

  test('never restates the per-account series it dropped', () => {
    expect(rendered()).not.toMatch(/perAccount/);
  });

  test('reports an empty series as a real zero rather than rendering nothing', () => {
    const empty = shapeTimeseries({ ...RESPONSE, portfolio: [] });

    const text = formatTimeseries(empty, WINDOW);

    expect(text).toMatch(/no point|no observation/i);
    expect(text).not.toContain('NaN');
  });
});
