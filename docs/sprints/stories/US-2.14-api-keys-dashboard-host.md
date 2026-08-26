---
id: US-2.14
title: "The API Keys dashboard host, and what the default base URL pairs with"
epic: EPIC-2
status: review
priority: P2
points: 2
sprint: sprint-2026-W35
assignee: jindo9986
created: 2026-08-25
updated: 2026-08-25
version_shipped:
depends_on: [US-2.3]
---

## Goal

Send a new user to the dashboard the rest of Senti sends them to. The
missing-key error is the first thing anyone running this server sees, and it named
a host nothing else in the product names — so the very first instruction the
server gives was inconsistent with every page that led the user here.

## Background

[US-2.3](US-2.3-live-smoke-test-and-readme.md) introduced
`https://stage.sentitrade.xyz/account/api-keys` as the dashboard URL, in the error
message and in the README, because that was where keys were issued at the time.

It has since drifted from the rest of the product. Koni's Senti landing pages link
`app.sentitrade.xyz` in 20 places, `guides.config.json` records
`products.senti.appUrl = https://app.sentitrade.xyz`, and the public docs at
`docs.sentitrade.xyz` — which the app itself links via
`REACT_APP_PUBLIC_API_DOCS_URL` — use `app` too. Only this server said `stage`.

### The question this opened, and did not close

The Senti frontends are built against `be-dev.sentitrade.xyz`, while
`DEFAULT_BASE_URL` here is `api.sentitrade.xyz`. Read as two environments, that is
a guaranteed `401` for anyone who never sets `SENTI_API_BASE_URL`.

That reading was written up and then withdrawn, because the evidence does not carry
it — see [CONTEXT D45](../../CONTEXT.md) and §Implementation notes. The two hosts
are indistinguishable from outside the deployment. This story therefore documents
the pairing as **unverified** and changes no default; settling it needs one call
with a real key, which is §Remaining work, not scope here.

## Acceptance criteria

1. The missing-`SENTI_API_KEY` startup error names
   `https://app.sentitrade.xyz/account/api-keys`.
2. `README.md` and `docs/SETUP.md` name the same host everywhere a reader is sent
   to create a key.
3. The docs state why the host swap is behaviour-neutral: both dashboards ship
   builds carrying the same `REACT_APP_API_URL`, so a key from either comes from
   the same backend.
4. The environment-pairing warning survives the rewrite. It must not claim the
   default is broken, and must not tell users to override `SENTI_API_BASE_URL`
   with a host that has not been shown to be a different environment.
5. Historical records — sprint stories, superpowers plans — are left alone. They
   record what was true when written.
6. No tool, input schema or response shape changes.
7. `VERSION`, `package.json`, `package-lock.json` and `SERVER_VERSION` all read
   `2.8.1`, with a `docs/CHANGELOG.md` entry in the same commit (RULE-1).

## Tasks

- [x] Swap the host in `src/config.ts`'s missing-key error (AC-1)
- [x] Swap it in `README.md` and `docs/SETUP.md` (AC-2)
- [x] Verify both dashboards' served bundles to justify the swap (AC-3)
- [x] Rewrite the pairing warning in both files without dropping the hedge (AC-4)
- [x] Leave `docs/sprints/` and `docs/superpowers/` untouched (AC-5)
- [x] Bump to 2.8.1 across all four version sites + CHANGELOG (AC-7)
- [x] Withdraw the over-claimed "default pairs with no dashboard" wording
- [x] Record the host question as CONTEXT D45
- [x] File this story and add it to sprint-2026-W35

## Dev notes

### Architecture constraints

`DEFAULT_BASE_URL` is untouched. Moving it is a deployment decision — which host
Senti wants to be canonical — not this server's, and changing it would break every
installation that relies on the current default.

### Cross-story dependencies

Supersedes the dashboard URL introduced by
[US-2.3](US-2.3-live-smoke-test-and-readme.md). That story's own file is not
edited: it is a record of what was decided on 2026-08-06.

### What we did NOT do

- Did not change `DEFAULT_BASE_URL`.
- Did not tell users to set `SENTI_API_BASE_URL=https://be-dev.sentitrade.xyz`. The
  first draft did, on an inference that did not hold.
- Did not touch the deployed API's own docs portal at `api.sentitrade.xyz/api/docs`,
  which still links `stage` because that deployment's `WASP_WEB_CLIENT_URL` says so.
  That is Senti-Quant infrastructure config.

### References

- [CONTEXT D45](../../CONTEXT.md) — the host decision and the withdrawn claim
- [US-2.3](US-2.3-live-smoke-test-and-readme.md) — where `stage` came from
- [PR #9](https://github.com/Koniverse/Senti-MCP/pull/9)

## Verification commands

```bash
npm run typecheck                      # clean
npm test                               # 673 passed, 2 skipped
npm run build && node dist/index.js    # prints the app.sentitrade.xyz URL
npm run release:check                  # every content check ok at 2.8.1

# AC-3: which backend does a dashboard host actually talk to?
for H in app.sentitrade.xyz stage.sentitrade.xyz; do
  J=$(curl -s "https://$H/" | grep -oE '/assets/index-[^"]+\.js' | head -1)
  printf '%-24s ' "$H"
  curl -s "https://$H$J" | grep -oE 'REACT_APP_API_URL:"[^"]+"'
done
```

## Implementation notes

The bundle check (AC-3) returned `REACT_APP_API_URL:"https://be-dev.sentitrade.xyz"`
for both hosts, and neither bundle references `api.sentitrade.xyz` at all. `app` and
`beta` serve a byte-identical build; `stage` a different one, same API URL.

That is what prompted the wrong inference. The correction came from probing the two
API hosts directly: `api.sentitrade.xyz` and `be-dev.sentitrade.xyz` return
byte-identical responses to every unauthenticated request tried — `/`, `/api/docs`,
`/auth/me`, and a 96,131-byte OpenAPI document whose embedded client URL matches.
Consistent with one origin behind two hostnames; not proof. Both are behind
Cloudflare, so DNS and headers distinguish nothing.

Commit 1 made the swap and asserted the mismatch. Commit 2 withdrew it in
`README.md`, `docs/SETUP.md`, the CHANGELOG entry and the PR body, before review.

## Files modified

- `src/config.ts` — dashboard URL, `SERVER_VERSION`
- `README.md`, `docs/SETUP.md` — dashboard URL, pairing warning
- `docs/CHANGELOG.md` — 2.8.1 entry
- `docs/CONTEXT.md` — D45
- `VERSION`, `package.json`, `package-lock.json` — 2.8.1

## Remaining work

One call settles the open question and is not in this story's scope:

```bash
curl -s -H "Authorization: Bearer sq_live_…" https://api.sentitrade.xyz/api/v1/accounts
```

A `200` means the default is correct and the pairing caveat can be deleted from
`README.md` and `docs/SETUP.md` outright. A `401` means `DEFAULT_BASE_URL` is wrong
and needs its own story. Either outcome supersedes [CONTEXT D45](../../CONTEXT.md)
with a revision entry.

## Changelog entry

### `2.8.1` — the API Keys dashboard URL

The missing-key startup error now sends people to
`https://app.sentitrade.xyz/account/api-keys` instead of `stage.sentitrade.xyz`, and
`README.md` and `docs/SETUP.md` follow. Behaviour-neutral: both dashboards front the
same backend. The environment-pairing warnings were rewritten to say that, and to
describe the default base URL as unverified rather than broken. No tool, schema or
response changed.
