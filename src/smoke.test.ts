import { describe, expect, test } from 'vitest';
import { formatAccounts, parseAccounts } from './tools/accounts/list-accounts.js';
import { formatConventions, parseConventions } from './tools/authoring/conventions.js';
import { DiagnosticSchema, formatDraft, parseDraft, shapeDraft } from './tools/authoring/get-draft.js';
import {
  formatAttachments,
  parseAttachments,
  shapeAttachments,
} from './tools/authoring/list-draft-attachments.js';
import { formatDrafts, parseDrafts, shapeDrafts } from './tools/authoring/list-drafts.js';
import { formatBrokers, parseBrokers } from './tools/brokers/list-brokers.js';
import {
  formatAccountStrategies,
  parseAccountStrategies,
} from './tools/strategies/list-account-strategies.js';
import { formatStrategies, parseStrategies } from './tools/strategies/list-strategies.js';
import {
  formatBreakdowns,
  parseBreakdowns,
  shapeBreakdowns,
} from './tools/performance/breakdowns.js';
import { formatPerformance, parsePerformance } from './tools/performance/summary.js';
import {
  formatTimeseries,
  MAX_POINTS,
  parseTimeseries,
  shapeTimeseries,
} from './tools/performance/timeseries.js';
import { formatDeals, parseDeals } from './tools/trading/deals.js';
import { capOrders, formatOrders, parseOrders } from './tools/trading/orders.js';
import { capPositions, formatPositions, parsePositions } from './tools/trading/positions.js';
import { formatCompile, parseCompile } from './tools/authoring/compile-draft.js';
import {
  formatAttachmentWrite,
  formatDraftWrite,
  parseDeleted,
  parseWrittenAttachment,
  parseWrittenDraft,
  shapeAttachmentWrite,
  shapeDraftWrite,
} from './tools/authoring/write-result.js';
import { accountPath, createClient, draftPath, newIdempotencyKey } from './core/client.js';
import { loadConfig } from './config.js';

/**
 * Opt-in: runs only when a real key is present, so CI and `npm test` skip it.
 * Invoke with `npm run test:smoke`, which loads `.env.local`.
 */
const smokeKey = process.env.SENTI_SMOKE_KEY;

describe.skipIf(!smokeKey)('smoke: live Senti API', () => {
  test('the whole W33 read path parses and renders against the live API', async () => {
    const config = loadConfig({
      SENTI_API_KEY: smokeKey,
      SENTI_API_BASE_URL: process.env.SENTI_API_BASE_URL ?? 'https://be-dev.sentitrade.xyz',
    });
    const client = createClient(config);

    const accounts = parseAccounts(await client.get('/api/v1/accounts', { scope: 'accounts:read' }));
    expect(formatAccounts(accounts).length).toBeGreaterThan(0);

    const brokers = parseBrokers(await client.get('/api/v1/brokers', { scope: 'brokers:read' }));
    expect(formatBrokers(brokers).length).toBeGreaterThan(0);

    const conventions = parseConventions(
      await client.get('/api/v1/authoring/conventions', { scope: 'authoring:read' }),
    );
    expect(conventions.limits.maxDrafts).toBeGreaterThan(0);
    expect(formatConventions(conventions)).toMatch(/authoring contract/i);

    const drafts = parseDrafts(await client.get('/api/v1/drafts', { scope: 'authoring:read' }));
    expect(formatDrafts(shapeDrafts(drafts)).length).toBeGreaterThan(0);

    if (drafts.length > 0) {
      const draft = parseDraft(
        await client.get(draftPath(drafts[0]!.id), { scope: 'authoring:read' }),
      );
      expect(formatDraft(shapeDraft(draft))).toContain(draft.id);

      const attachments = parseAttachments(
        await client.get(draftPath(drafts[0]!.id, 'attachments'), { scope: 'authoring:read' }),
      );
      expect(
        formatAttachments(
          shapeAttachments(attachments),
          undefined,
          attachments.map((attachment) => attachment.filename),
        ).length,
      ).toBeGreaterThan(0);
    }

    const strategies = parseStrategies(
      await client.get('/api/v1/strategies', { scope: 'strategies:read' }),
    );
    expect(formatStrategies(strategies).length).toBeGreaterThan(0);

    const first = accounts[0];
    if (!first) {
      // Not a failure: a key with no linked account has nothing account-scoped
      // to prove. Everything above still ran.
      return;
    }

    const deployed = parseAccountStrategies(
      await client.get(accountPath(first.id, 'strategies'), { scope: 'strategies:read' }),
    );
    expect(formatAccountStrategies(deployed).length).toBeGreaterThan(0);

    // A 409 here means the terminal is offline, which is a real state of the
    // world rather than a broken contract — so it is tolerated, and only a
    // parse or render failure fails this test.
    try {
      const positions = parsePositions(
        await client.get(accountPath(first.id, 'positions'), {
          scope: 'trading:read',
          conflictMeans: 'terminal offline',
        }),
      );
      const capped = capPositions(positions);

      expect(
        formatPositions(capped.positions, capped.notes, capped.totals).length,
      ).toBeGreaterThan(0);
    } catch (error) {
      expect(String(error)).toMatch(/409/);
    }

    // `list_pending_orders` is this task's own tool and the sixth leg of "the
    // whole W33 read path" this test claims to walk, so it is exercised here
    // too even though the task-19 brief's Step 4 code block omitted it — same
    // terminal-offline tolerance as positions above.
    try {
      const orders = parseOrders(
        await client.get(accountPath(first.id, 'orders'), {
          scope: 'trading:read',
          conflictMeans: 'terminal offline',
        }),
      );
      const cappedOrders = capOrders(orders);

      expect(
        formatOrders(cappedOrders.orders, cappedOrders.notes, cappedOrders.totals).length,
      ).toBeGreaterThan(0);
    } catch (error) {
      expect(String(error)).toMatch(/409/);
    }

    // No terminal-offline tolerance here, and that is the point: `performance`
    // declares no 409. An offline terminal arrives as `live: null` inside a
    // 200, so this leg must parse and render either way — a throw is a real
    // failure, not a state of the world.
    const window = { from: '2026-07-01', to: '2026-07-31', reporting: 'USD' };
    const performance = parsePerformance(
      await client.get(accountPath(first.id, 'performance'), {
        scope: 'performance:read',
        query: window,
      }),
    );

    expect(formatPerformance(performance, window).length).toBeGreaterThan(0);
    // The window is what makes this leg more than a schema check: an omitted
    // `from`/`to` would exercise the API's default and prove nothing about the
    // query option this story exists to wire up.
    expect(formatPerformance(performance, window)).toContain('2026-07-01');

    // `deals` declares no 409 either — it reads the warehouse, not the
    // terminal — so a throw here is a real failure rather than a state of the
    // world, same as `performance` above.
    //
    // `limit: 2` is deliberate. It keeps the live call small and makes a
    // second page near-certain on any account that has traded more than
    // twice, which is what puts the *more-available* branch under a live
    // cursor instead of only under a fixture.
    const dealQuery = { limit: 2 };
    const firstPage = parseDeals(
      await client.get(accountPath(first.id, 'deals'), {
        scope: 'trading:read',
        query: dealQuery,
      }),
    );
    const rendered = formatDeals(firstPage, dealQuery);

    expect(rendered.length).toBeGreaterThan(0);

    if (firstPage.nextCursor === null) {
      // Not a failure, and not a skipped leg: an account with two deals or
      // fewer has no second page to prove. The last-page branch is the one
      // that ran, and it rendered — that is what this asserts.
      expect(rendered).toMatch(/last page/i);
    } else {
      expect(rendered).toMatch(/more deals are available/i);
      // The cursor reaches the model through the text, not only through
      // `structuredContent`, so the text is where it has to be checked.
      expect(rendered).toContain(firstPage.nextCursor);

      const secondPage = parseDeals(
        await client.get(accountPath(first.id, 'deals'), {
          scope: 'trading:read',
          query: { ...dealQuery, cursor: firstPage.nextCursor },
        }),
      );

      // A cursor the API accepts and that actually advances. Echoing page one
      // back would satisfy a schema check and still be a broken contract.
      expect(secondPage.deals.length).toBeGreaterThan(0);
      expect(secondPage.deals.map((deal) => deal.ticket)).not.toEqual(
        firstPage.deals.map((deal) => deal.ticket),
      );
    }

    // `breakdowns` is the largest payload the API serves, and the only tool
    // with a payload budget rather than a latency one. The widest window the
    // account can produce is the one that has to fit, so this leg asks for the
    // whole of its history rather than a convenient month — a 30-day default
    // would prove the cuts run and nothing about whether they are enough.
    const widest = {
      from: first.createdAt.slice(0, 10),
      to: new Date().toISOString().slice(0, 10),
      reporting: 'USD',
    };
    const rawBreakdowns = await client.get(accountPath(first.id, 'performance', 'breakdowns'), {
      scope: 'performance:read',
      query: widest,
    });
    const shaped = shapeBreakdowns(parseBreakdowns(rawBreakdowns));
    const breakdownsText = formatBreakdowns(shaped, widest);

    const rawBytes = JSON.stringify(rawBreakdowns).length;
    const shapedBytes = JSON.stringify(shaped).length;
    // Measured, not asserted-and-forgotten: the figure goes into US-2.12's
    // §Implementation notes, and this line is where a later reader re-reads it
    // off a live account instead of trusting the number written down.
    console.error(
      `[smoke] breakdowns ${widest.from} → ${widest.to}: raw ${rawBytes} bytes ` +
        `(~${Math.round(rawBytes / 4)} tok) → shaped ${shapedBytes} bytes ` +
        `(~${Math.round(shapedBytes / 4)} tok), ` +
        `${(100 - (shapedBytes / rawBytes) * 100).toFixed(1)}% removed`,
    );

    expect(breakdownsText.length).toBeGreaterThan(0);
    // The budget in US-2.12 §Performance budget, as a test rather than a note.
    expect(shapedBytes).toBeLessThan(rawBytes / 2);
    expect(shapedBytes / 4).toBeLessThan(5_000);

    // Cut 1 and cut 2 against live data: `perAccount` is gone, and so are the
    // running sums it and `daily` carried.
    expect(shaped).not.toHaveProperty('perAccount');
    for (const row of shaped.daily) expect(row).not.toHaveProperty('cumulativePnl');
    expect(shaped.perSymbol).not.toHaveProperty('cumPnlRows');

    // Cut 4 always applies, so on any account with more than one active date
    // there is a note — and every note has to reach the text, not only
    // `structuredContent`.
    for (const note of shaped.notes) expect(breakdownsText).toContain(note);
    expect(shaped.perSymbol.pnlSymbols.length).toBeLessThanOrEqual(10);

    // `timeseries` declares no 409 either, and it is the second tool with a
    // payload budget rather than a latency one. Same widest window, for the
    // same reason: the 200-point cap has to hold on the longest series this
    // account can produce, not on a convenient month.
    const rawTimeseries = await client.get(accountPath(first.id, 'performance', 'timeseries'), {
      scope: 'performance:read',
      query: widest,
    });
    const series = parseTimeseries(rawTimeseries);
    const shapedSeries = shapeTimeseries(series);
    const seriesText = formatTimeseries(shapedSeries, widest);

    console.error(
      `[smoke] timeseries ${widest.from} → ${widest.to}: ${series.portfolio.length} raw ` +
        `point(s) → ${shapedSeries.portfolio.length} kept`,
    );

    expect(seriesText.length).toBeGreaterThan(0);
    expect(shapedSeries.portfolio.length).toBeLessThanOrEqual(MAX_POINTS);
    expect(shapedSeries).not.toHaveProperty('perAccount');
    for (const note of shapedSeries.notes) expect(seriesText).toContain(note);

    // AC-4 against live data rather than against a fixture built to defeat a
    // naive stride. Whatever shape the real curve has, the three points a
    // trader asks about are the ones that survived.
    const raw = series.portfolio;
    const firstPoint = raw[0];
    const lastPoint = raw[raw.length - 1];

    if (firstPoint && lastPoint) {
      const deepest = raw.reduce((trough, point) =>
        Math.abs(point.drawdownPct) > Math.abs(trough.drawdownPct) ? point : trough,
      );

      expect(shapedSeries.portfolio[0]).toEqual(firstPoint);
      expect(shapedSeries.portfolio[shapedSeries.portfolio.length - 1]).toEqual(lastPoint);
      expect(shapedSeries.portfolio).toContainEqual(deepest);
    }

    // The API's own qualifications, through the live path: never shortened,
    // whatever else this tool cut.
    expect(shapedSeries.portfolioCaveats).toEqual(series.portfolioCaveats);
    expect(shapedSeries.caveats).toEqual(series.caveats);
  }, 60_000);
});

/**
 * Opt-in twice: a real key, and an explicit acknowledgement that this suite
 * creates and deletes a real draft on the account the key belongs to. The read
 * smoke above never writes, whatever this is set to.
 */
const writeSmoke = process.env.SENTI_SMOKE_WRITES === '1';

/** Cleanup only — see the comment at the call site for why this may retry. */
async function deleteWithRetry(
  client: ReturnType<typeof createClient>,
  draftId: string,
  attempts = 4,
): Promise<unknown> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await client.send('DELETE', draftPath(draftId), { scope: 'authoring:write' });
    } catch (error) {
      if (attempt >= attempts || !/\b429\b/.test(String(error))) throw error;
      // The API sends Retry-After on a 429; 15s covers the observed window
      // without parsing a header this test does not otherwise need.
      await new Promise((resolve) => setTimeout(resolve, 15_000));
    }
  }
}

describe.skipIf(!smokeKey || !writeSmoke)('smoke: live Senti authoring write path', () => {
  test('creates, attaches, compiles and deletes a real draft', async () => {
    const config = loadConfig({
      SENTI_API_KEY: smokeKey,
      SENTI_API_BASE_URL: process.env.SENTI_API_BASE_URL ?? 'https://be-dev.sentitrade.xyz',
      SENTI_ENABLE_AUTHORING_WRITE: '1',
    });
    const client = createClient(config);

    // A name no human would pick, so a leaked draft is identifiable as this
    // test's. The timestamp keeps two runs from colliding on the unique-name
    // 409 — this is a live account, not a fixture.
    const name = `senti-mcp-smoke-${Date.now()}`;
    const source = [
      '#property strict',
      'int OnInit(){ return(INIT_SUCCEEDED); }',
      'void OnTick(){}',
      '',
    ].join('\n');

    const created = shapeDraftWrite(
      parseWrittenDraft(
        await client.send('POST', '/api/v1/drafts', {
          body: { name, sourceCode: source },
          idempotencyKey: newIdempotencyKey(),
          scope: 'authoring:write',
        }),
        'created draft',
      ),
    );

    try {
      expect(created.sourceBytes).toBe(Buffer.byteLength(source, 'utf8'));
      expect(formatDraftWrite(created, 'created')).toContain(created.id);
      // The cut is the point: the source went up, and does not come back.
      expect(JSON.stringify(created)).not.toContain('OnTick');

      const attachPath = draftPath(created.id, 'attachments');
      const attached = shapeAttachmentWrite(
        parseWrittenAttachment(
          await client.send('POST', attachPath, {
            body: {
              filename: 'SmokeInd.mq5',
              sourceCode: '#property indicator_chart_window\n',
            },
            idempotencyKey: newIdempotencyKey(),
            scope: 'authoring:write',
          }),
          'created attachment',
        ),
      );

      // EPIC-7 closed with every attachment branch test-covered and none
      // live-covered, because the smoke account held zero attachments and
      // creating one needed a write. This is that gap closing.
      expect(attached.filename).toBe('SmokeInd.mq5');
      expect(formatAttachmentWrite(attached, 'attached to', created.id)).toContain(
        '#resource "SmokeInd.ex5"',
      );

      const listed = parseAttachments(await client.get(attachPath, { scope: 'authoring:read' }));
      expect(listed.map((entry) => entry.filename)).toContain('SmokeInd.mq5');

      const compiled = parseCompile(
        await client.send('POST', draftPath(created.id, 'compile'), {
          scope: 'authoring:write',
          conflictMeans: 'a compile is already running for this account',
        }),
      );

      // A red build is a legitimate outcome of this leg. What is asserted is
      // that the contract parses and renders, not that the EA is any good.
      expect(typeof compiled.ok).toBe('boolean');
      expect(formatCompile(compiled, created.id).length).toBeGreaterThan(0);
      console.error(
        `[smoke] compile ok=${compiled.ok} errors=${compiled.errors} ` +
          `warnings=${compiled.warnings} diagnostics=${compiled.diagnostics.length}`,
      );

      // EPIC-7's second gap: no diagnostic object had ever been observed live,
      // so the strict schema had never met real data.
      for (const entry of compiled.diagnostics) {
        console.error(`[smoke] diagnostic ${JSON.stringify(entry)}`);
        expect(DiagnosticSchema.safeParse(entry).success).toBe(true);
      }
    } finally {
      // Runs even when an assertion above fails: a leaked draft counts against
      // the account's cap and against the next run's unique-name check.
      //
      // This is the ONE place in this repo that retries, and it is not a tool.
      // The no-retry rule (CONTEXT D40) is a claim about the tool surface, made
      // because a retry against a globally serial compile slot is a
      // denial-of-service. Cleanup is the opposite case: the rate limit is 60
      // per window and this test spends five requests, so a run that follows
      // another can meet a 429 on the DELETE — observed on 2026-08-21, and it
      // left a draft behind. A cleanup that gives up on a transient status is
      // a test that leaks state into the next run.
      const deleted = parseDeleted(await deleteWithRetry(client, created.id), 'deleted draft');
      expect(deleted.id).toBe(created.id);
    }
  }, 120_000);
});
