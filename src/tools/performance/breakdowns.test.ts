import { describe, expect, test } from 'vitest';
import {
  BreakdownsOutputSchema,
  formatBreakdowns,
  parseBreakdowns,
  shapeBreakdowns,
  type Breakdowns,
} from './breakdowns.js';

const DATES = ['2026-07-01', '2026-07-02', '2026-07-03'];

/**
 * P&L per symbol per date, and the fixture's whole point.
 *
 * The first ten net out at 1200 down to 300 in absolute terms, so their rank
 * order is unambiguous. The last two are the discriminating pair: `SYM11` nets
 * a plainly small 200, while `SYM12` swings +5000 then -5100 to net -100. Under
 * "sum of absolute daily P&L" `SYM12` would rank first of all twelve; under the
 * criterion AC-5 states — largest absolute *net* P&L — it ranks last. A cut
 * that keeps `SYM12` has implemented the wrong rule and this fixture is what
 * says so.
 */
const SYMBOL_PNL: Record<string, [number, number, number]> = {
  SYM01: [600, 400, 200],
  SYM02: [-500, -400, -200],
  SYM03: [500, 300, 200],
  SYM04: [-400, -300, -200],
  SYM05: [400, 300, 100],
  SYM06: [-300, -300, -100],
  SYM07: [300, 200, 100],
  SYM08: [-200, -200, -100],
  SYM09: [200, 100, 100],
  SYM10: [-100, -100, -100],
  SYM11: [100, 50, 50],
  SYM12: [5000, -5100, 0],
};

const SYMBOLS = Object.keys(SYMBOL_PNL);
/** Net P&L: 1200, -1100, 1000, -900, 800, -700, 600, -500, 400, -300, 200, -100. */
const KEPT = SYMBOLS.slice(0, 10);
const DROPPED = ['SYM11', 'SYM12'];

const label = (dateKey: string) => `Jul ${Number(dateKey.slice(8))}`;

/** `{ date, dateKey, SYM01: n, … }`, the shape the API sends for these blocks. */
function seriesRows(column: (symbol: string, index: number) => number) {
  return DATES.map((dateKey, index) => ({
    date: label(dateKey),
    dateKey,
    ...Object.fromEntries(SYMBOLS.map((symbol) => [symbol, column(symbol, index)])),
  }));
}

function runningRows(column: (symbol: string, index: number) => number) {
  return seriesRows((symbol, index) =>
    Array.from({ length: index + 1 }, (_, step) => column(symbol, step)).reduce(
      (sum, value) => sum + value,
      0,
    ),
  );
}

const pnlAt = (symbol: string, index: number) => SYMBOL_PNL[symbol]?.[index] ?? 0;
/** Two deals per symbol per day, so a deal count is never confused with a P&L. */
const dealsAt = () => 2;

const HOURS = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, '0')}:00`);

/** 14:00 earns, 03:00 loses, and every other hour is flat. */
const HOUR_PNL: Record<string, number> = { '14:00': 900, '03:00': -400 };

/**
 * The API returns its series newest hour first — `23:00` down to `00:00` — and
 * one date per point, so `order` defaults to that rather than to whatever is
 * convenient to assert against.
 *
 * `order` exists so the two series can be given to `shapeBreakdowns` in
 * *different* orders. That is not something the live API does today: it is what
 * makes the by-name matching load-bearing. Built parallel, a bucketer that
 * pairs `pnlSeries[i]` with `tradeCountSeries[i]` produces exactly the same
 * answer as one that matches on `name`, and the test cannot tell them apart —
 * which is a test that passes for the wrong reason the day the API reorders
 * one array.
 */
const heatmapSeries = (value: (hour: string) => number, order: 'desc' | 'asc' = 'desc') =>
  (order === 'desc' ? [...HOURS].reverse() : [...HOURS]).map((hour) => ({
    name: hour,
    // Split across the three dates, which is what the collapse has to re-add.
    data: DATES.map((date, index) => ({ x: date, y: index === 0 ? value(hour) : 0 })),
  }));

const BREAKDOWNS: Breakdowns = {
  daily: DATES.map((dateKey, index) => ({
    date: label(dateKey),
    dateKey,
    pnl: [500, 300, 200][index] ?? 0,
    volume: [1.5, 0.75, 0.5][index] ?? 0,
    notionalVolume: [150_000, 75_000, 50_000][index] ?? 0,
    cumulativePnl: [500, 800, 1000][index] ?? 0,
    cumulativeVolume: [1.5, 2.25, 2.75][index] ?? 0,
    cumulativeNotional: [150_000, 225_000, 275_000][index] ?? 0,
  })),
  perAccount: {
    logins: ['413878201'],
    dailyPnlRows: DATES.map((dateKey) => ({ date: label(dateKey), dateKey, '413878201': 500 })),
    dailyVolumeRows: [],
    dailyNotionalRows: [],
    cumPnlRows: [],
    cumVolumeRows: [],
    cumNotionalRows: [],
  },
  perSymbol: {
    pnlSymbols: SYMBOLS,
    dealsSymbols: SYMBOLS,
    dailyPnlRows: seriesRows(pnlAt),
    dailyDealsRows: seriesRows(dealsAt),
    cumPnlRows: runningRows(pnlAt),
    cumDealsRows: runningRows(dealsAt),
  },
  heatmap: {
    dates: DATES,
    pnlSeries: heatmapSeries((hour) => HOUR_PNL[hour] ?? 0),
    tradeCountSeries: heatmapSeries((hour) => (HOUR_PNL[hour] === undefined ? 0 : 3), 'asc'),
  },
};

/** Nothing to cut: two symbols, and a heatmap that already covers one date. */
const NOTHING_TO_CUT: Breakdowns = {
  daily: BREAKDOWNS.daily,
  perAccount: BREAKDOWNS.perAccount,
  perSymbol: {
    pnlSymbols: ['SYM01', 'SYM02'],
    dealsSymbols: ['SYM01', 'SYM02'],
    dailyPnlRows: [{ date: 'Jul 1', dateKey: '2026-07-01', SYM01: 100, SYM02: -50 }],
    dailyDealsRows: [{ date: 'Jul 1', dateKey: '2026-07-01', SYM01: 2, SYM02: 1 }],
    cumPnlRows: [{ date: 'Jul 1', dateKey: '2026-07-01', SYM01: 100, SYM02: -50 }],
    cumDealsRows: [{ date: 'Jul 1', dateKey: '2026-07-01', SYM01: 2, SYM02: 1 }],
  },
  heatmap: {
    dates: ['2026-07-01'],
    pnlSeries: [{ name: '14:00', data: [{ x: '2026-07-01', y: 50 }] }],
    tradeCountSeries: [{ name: '14:00', data: [{ x: '2026-07-01', y: 3 }] }],
  },
};

const WINDOW = { from: '2026-07-01', to: '2026-07-03', reporting: 'USD' };

const shaped = () => shapeBreakdowns(BREAKDOWNS);
const rendered = () => formatBreakdowns(shaped(), WINDOW);

describe('parseBreakdowns', () => {
  test('accepts a live-shaped payload', () => {
    expect(() => parseBreakdowns(BREAKDOWNS)).not.toThrow();
  });

  test('names the field and the subject when the API changes shape', () => {
    const broken = { ...BREAKDOWNS, daily: [{ ...BREAKDOWNS.daily[0], pnl: 'a lot' }] };

    expect(() => parseBreakdowns(broken)).toThrow(/performance breakdowns at "daily\.0\.pnl"/);
  });

  test('does not reject a response whose perAccount block changed shape', () => {
    // The one block this tool drops whole. Validating it would turn an upstream
    // change in data nobody reads into an outage for the data everybody does —
    // see `BreakdownsSchema`.
    expect(() => parseBreakdowns({ ...BREAKDOWNS, perAccount: { somethingNew: 1 } })).not.toThrow();
  });
});

describe('cut 1 — perAccount', () => {
  test('drops the block from the structured output entirely', () => {
    expect(shaped()).not.toHaveProperty('perAccount');
    expect(Object.keys(shaped())).toEqual(['daily', 'perSymbol', 'hourly', 'notes']);
  });

  test('drops it from the text too — the login never reaches the model', () => {
    expect(rendered()).not.toContain('413878201');
    expect(rendered()).not.toMatch(/perAccount/);
  });

  test('leaves no note, because the block restated data that is still here', () => {
    expect(shaped().notes.join(' ')).not.toMatch(/perAccount|per-account/i);
  });
});

describe('cut 2 — the running sums in daily', () => {
  test('drops all three cumulative columns', () => {
    for (const row of shaped().daily) {
      expect(row).not.toHaveProperty('cumulativePnl');
      expect(row).not.toHaveProperty('cumulativeVolume');
      expect(row).not.toHaveProperty('cumulativeNotional');
    }
  });

  test('retains the columns they were running sums of, in full', () => {
    expect(shaped().daily).toEqual([
      { date: 'Jul 1', dateKey: '2026-07-01', pnl: 500, volume: 1.5, notionalVolume: 150_000 },
      { date: 'Jul 2', dateKey: '2026-07-02', pnl: 300, volume: 0.75, notionalVolume: 75_000 },
      { date: 'Jul 3', dateKey: '2026-07-03', pnl: 200, volume: 0.5, notionalVolume: 50_000 },
    ]);
  });

  test('keeps every date — this cut removes columns, not rows', () => {
    expect(shaped().daily.map((row) => row.dateKey)).toEqual(DATES);
  });
});

describe('cut 3 — perSymbol beyond the top ten', () => {
  test('keeps exactly the ten symbols with the largest absolute net P&L', () => {
    expect(shaped().perSymbol.pnlSymbols).toEqual(KEPT);
    expect(shaped().perSymbol.dealsSymbols).toEqual(KEPT);
  });

  test('ranks on absolute net P&L, not on churn', () => {
    // SYM12 swings +5000 then -5100. It has by far the largest daily figures
    // of any symbol here and the smallest net, and the criterion is net.
    expect(shaped().perSymbol.pnlSymbols).not.toContain('SYM12');
  });

  test('drops the columns from every row-set', () => {
    for (const row of [...shaped().perSymbol.dailyPnlRows, ...shaped().perSymbol.dailyDealsRows]) {
      for (const symbol of DROPPED) expect(row).not.toHaveProperty(symbol);
      for (const symbol of KEPT) expect(row).toHaveProperty(symbol);
    }
  });

  test('keeps every dateKey row — the cut removes columns, not dates', () => {
    expect(shaped().perSymbol.dailyPnlRows.map((row) => row.dateKey)).toEqual(DATES);
    expect(shaped().perSymbol.dailyDealsRows.map((row) => row.dateKey)).toEqual(DATES);
  });

  test('leaves the date labels on the rows alone', () => {
    expect(shaped().perSymbol.dailyPnlRows[0]?.date).toBe('Jul 1');
  });

  test('states how many symbols went and by what criterion, in notes', () => {
    const note = shaped().notes.find((entry) => /symbol/i.test(entry));

    expect(note).toBeDefined();
    expect(note).toContain('12 symbols');
    expect(note).toMatch(/keeps the 10/);
    expect(note).toMatch(/dropping the other 2/);
    expect(note).toMatch(/absolute net P&L/);
    // Which ones went, so a model can say "I have nothing on SYM12" instead of
    // "SYM12 was not traded".
    expect(note).toContain('SYM11, SYM12');
  });

  test('repeats that sentence in the text, not only in structuredContent', () => {
    const note = shaped().notes.find((entry) => /symbol/i.test(entry));

    // Whole-sentence containment, not a keyword match: many hosts surface
    // `content` alone, so the text has to carry the note itself.
    expect(rendered()).toContain(note);
  });

  test('tells the reader how to get a dropped symbol back', () => {
    const note = shaped().notes.find((entry) => /symbol/i.test(entry)) ?? '';

    expect(note).toMatch(/narrow/i);
    expect(note).toMatch(/from`\/`to`/);
  });
});

describe('cut 5 — the running sums in perSymbol', () => {
  test('drops cumPnlRows and cumDealsRows', () => {
    expect(shaped().perSymbol).not.toHaveProperty('cumPnlRows');
    expect(shaped().perSymbol).not.toHaveProperty('cumDealsRows');
  });

  test('leaves no note — the totals are still derivable from the rows that stay', () => {
    // The text quotes a per-symbol net P&L, and it can only have come from
    // summing the daily rows, since the running sums are gone.
    expect(rendered()).toContain('SYM01 — net P&L +1,200.00');
  });
});

describe('cut 4 — the heatmap', () => {
  test('collapses to 24 hourly buckets', () => {
    expect(shaped().hourly).toHaveLength(24);
    expect(shaped().hourly.map((bucket) => bucket.hour)).toEqual(HOURS);
  });

  test('returns the day in order, though the API returns it backwards', () => {
    expect(BREAKDOWNS.heatmap.pnlSeries[0]?.name).toBe('23:00');
    expect(shaped().hourly[0]?.hour).toBe('00:00');
    expect(shaped().hourly[23]?.hour).toBe('23:00');
  });

  test('pairs P&L with the deal count of the same hour, not of the same array index', () => {
    // The fixture hands the two series over in opposite orders. Index pairing
    // would put 14:00's P&L against 09:00's deal count and still look plausible.
    expect(BREAKDOWNS.heatmap.pnlSeries[0]?.name).toBe('23:00');
    expect(BREAKDOWNS.heatmap.tradeCountSeries[0]?.name).toBe('00:00');

    for (const bucket of shaped().hourly) {
      // Only the two hours that traded have a deal count, and they are the two
      // that have a P&L. Any misalignment separates the pair.
      expect(bucket.deals === 0, bucket.hour).toBe(bucket.pnl === 0);
    }
  });

  test('totals each hour across every date, losing no P&L', () => {
    const fourteen = shaped().hourly.find((bucket) => bucket.hour === '14:00');
    const three = shaped().hourly.find((bucket) => bucket.hour === '03:00');

    expect(fourteen).toEqual({ hour: '14:00', pnl: 900, deals: 3 });
    expect(three).toEqual({ hour: '03:00', pnl: -400, deals: 3 });
    expect(shaped().hourly.reduce((sum, bucket) => sum + bucket.pnl, 0)).toBe(500);
  });

  test('records the collapse in notes', () => {
    const note = shaped().notes.find((entry) => /hour/i.test(entry));

    expect(note).toBeDefined();
    expect(note).toMatch(/3 dates × 24 hours/);
    expect(note).toMatch(/which hour of the day trades worst but not which hour of which date/);
  });

  test('repeats that sentence in the text as well', () => {
    expect(rendered()).toContain(shaped().notes.find((entry) => /hour/i.test(entry)));
  });

  test('answers "what hour do I trade worst" in the text', () => {
    expect(rendered()).toMatch(/Best hour 14:00 \(\+900\.00\).*worst hour 03:00 \(-400\.00\)/);
  });
});

describe('notes when nothing was cut', () => {
  test('is the empty array', () => {
    expect(shapeBreakdowns(NOTHING_TO_CUT).notes).toEqual([]);
  });

  test('still applies the lossless cuts', () => {
    const output = shapeBreakdowns(NOTHING_TO_CUT);

    // An empty `notes` is a claim that nothing was lost — not that nothing was
    // removed. All three lossless cuts still ran.
    expect(output).not.toHaveProperty('perAccount');
    expect(output.daily[0]).not.toHaveProperty('cumulativePnl');
    expect(output.perSymbol).not.toHaveProperty('cumPnlRows');
  });

  test('renders no Notes section at all, rather than an empty one', () => {
    expect(formatBreakdowns(shapeBreakdowns(NOTHING_TO_CUT), WINDOW)).not.toContain('Notes:');
  });

  test('emits no symbol note when a response has exactly ten symbols', () => {
    const ten = {
      ...NOTHING_TO_CUT,
      perSymbol: { ...NOTHING_TO_CUT.perSymbol, pnlSymbols: KEPT, dealsSymbols: KEPT },
    };

    expect(shapeBreakdowns(ten).notes).toEqual([]);
  });

  test('emits a symbol note at eleven', () => {
    const eleven = {
      ...NOTHING_TO_CUT,
      perSymbol: {
        ...NOTHING_TO_CUT.perSymbol,
        pnlSymbols: [...KEPT, 'SYM11'],
        dealsSymbols: [...KEPT, 'SYM11'],
      },
    };

    expect(shapeBreakdowns(eleven).notes).toHaveLength(1);
    expect(shapeBreakdowns(eleven).notes[0]).toMatch(/dropping the other 1/);
  });
});

describe('the shaped output', () => {
  test('validates against the schema the tool advertises', () => {
    expect(BreakdownsOutputSchema.safeParse(shaped()).success).toBe(true);
    expect(BreakdownsOutputSchema.safeParse(shapeBreakdowns(NOTHING_TO_CUT)).success).toBe(true);
  });

  test('is a fraction of the payload it was shaped from', () => {
    const raw = JSON.stringify(BREAKDOWNS).length;
    const out = JSON.stringify(shaped()).length;

    // A guard on the whole point of this module rather than a precise figure:
    // the live measurement is in the story's implementation notes.
    expect(out).toBeLessThan(raw / 2);
  });
});

describe('formatBreakdowns', () => {
  test('says which window and currency the figures cover', () => {
    expect(rendered()).toContain('2026-07-01 → 2026-07-03');
    expect(rendered()).toContain('in USD');
  });

  test('names USD when the caller chose no reporting currency', () => {
    expect(formatBreakdowns(shaped(), { from: '2026-07-01' })).toContain('in USD');
  });

  test('says the response is shaped, whether or not anything was cut', () => {
    expect(rendered()).toMatch(/shaped/i);
    expect(formatBreakdowns(shapeBreakdowns(NOTHING_TO_CUT), WINDOW)).toMatch(/shaped/i);
  });

  test('points a whole-account question at get_account_performance', () => {
    expect(rendered()).toContain('get_account_performance');
  });

  test('answers "which symbol is losing me money", worst first among losers', () => {
    expect(rendered()).toContain('SYM02 — net P&L -1,100.00');
    expect(rendered()).toContain('SYM01 — net P&L +1,200.00 · 6 deal(s)');
  });

  test('summarizes the daily series rather than restating every row', () => {
    // Both channels reach the model's context, so a text that repeats the
    // series doubles the payload the cuts exist to reduce.
    expect(rendered()).toContain('3 day(s) with activity');
    expect(rendered()).toContain('Best day 2026-07-01 (+500.00)');
    expect(rendered()).toContain('worst day 2026-07-03 (+200.00)');
    expect(rendered()).not.toContain('notionalVolume');
  });

  test('lists only the hours that traded, and says how many were silent', () => {
    expect(rendered()).toContain('- 14:00 — net P&L +900.00 · 3 deal(s)');
    expect(rendered()).not.toContain('- 09:00');
    expect(rendered()).toContain('The other 22 hour(s) had no activity.');
  });

  test('states an empty window as a real zero rather than rendering nothing', () => {
    const empty = shapeBreakdowns({
      daily: [],
      perAccount: {},
      perSymbol: {
        pnlSymbols: [],
        dealsSymbols: [],
        dailyPnlRows: [],
        dailyDealsRows: [],
        cumPnlRows: [],
        cumDealsRows: [],
      },
      heatmap: { dates: [], pnlSeries: [], tradeCountSeries: [] },
    });

    const text = formatBreakdowns(empty, WINDOW);

    expect(empty.notes).toEqual([]);
    expect(text).toMatch(/real zero/);
    expect(text).toMatch(/no symbol traded/i);
    expect(text).toMatch(/no hour of the day has activity/i);
  });
});
