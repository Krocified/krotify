# v4 Discovery Exploration and Decision Plan

> **For agentic workers:** Use this plan with `superpowers:executing-plans`. Every task ends with a written artifact and an explicit adopt/defer/drop ruling. No implementation task starts until its memo is reviewed.

**Goal:** Decide with evidence whether Krotify adds external discovery: Genius metadata, Radio Browser internet radio, and Audiometa.io catalogue data. Each source gets a written verdict with cost, legal notes, failure behavior and the smallest shippable slice.

**Architecture:** v4 is a research milestone. The app stays local-first and offline by default. Any adopted source is a separate, opt-in surface with its own client, cache and attribution; it never replaces or mixes into the local library queue. No new dependency or network call lands without a reviewed memo.

**Tech Stack:** Existing Expo SDK 58 app, `expo-audio` (`AudioPlaylist`, `isLiveStream`), `fetch`, `expo-sqlite` for cache, the current state-tab shell. No new runtime dependency during research.

**Spec:** `docs/spec.md` (v4 section; guardrails in External services).

## Global Constraints

- Local playback, imports, playlists and favorites must keep working with no network and no account.
- Every external surface is opt-in, labelled and separated from the local library.
- Requests identify the client: `User-Agent: Krotify <version> (https://github.com/Krocified/krotify)`, or `X-User-Agent` on web.
- Honor rate limits, cache responses, show attribution, and never scrape a web page for data an API does not provide.
- Genius is metadata only. LRCLIB remains the lyrics source; no lyrics from Genius.
- No licensed lyric catalogue, no YouTube scraping, no direct-to-radio mixing in the local queue.
- Research writes only Markdown and spec updates. No dependency, config or runtime code until the memo is reviewed.
- Run `npm test`, `npx tsc --noEmit`, `npx expo lint`, and `npx expo export --platform web` before any code task is declared done.
- Conventional Commits. Never push without an explicit instruction in the current request.

## Review Focus

1. **Offline start:** with no network, the app still scans, plays, imports and restores the last session, and no discovery surface blocks first paint.
2. **Missing or bad API data:** a 401, 429, 5xx, malformed JSON, empty catalogue or partial fields never crashes a screen or hides local content.
3. **Stream failure:** a radio stream that stalls, redirects, changes codec or goes offline shows a recoverable state and never wedges the local player.
4. **Privacy:** only the minimum fields leave the device, requests are opt-in, and the UI names what is sent before the first call.
5. **Attribution and terms:** every adopted source shows its required credit and its terms are recorded before ship.

---

## Decision Memo Template

Save one memo per source under `docs/superpowers/plans/` or `docs/research/`, named
`v4-<source>-memo.md`. Each memo contains:

```markdown
# <Source> Decision Memo

**Verdict:** adopt | defer | drop
**Date:** YYYY-MM-DD
**Evidence:** <links to docs, terms, and captured sample responses>

## What it gives
## What it does not give
## Terms and legal notes
## Auth, cost and rate limits
## Data sent from the device
## Cache and offline behavior
## Failure behavior
## UX surface
## Smallest shippable slice
## Why this verdict
## Follow-ups before code
```

No memo, no code.

---

### Task 1: Genius metadata spike

**Files:**
- Create: `docs/research/v4-genius-memo.md`
- Create: `docs/research/samples/genius-search.json` and `genius-song.json` (redacted)

**Interfaces:**
- Candidate client shape only, for the memo: `searchSong(query): Promise<GeniusHit[]>` and `getSong(id): Promise<GeniusSong>`.

- [ ] Read the current `https://docs.genius.com` reference and confirm the public API surface: authenticated search, song/artist lookup, annotations; no lyrics payload.
- [ ] Read the developer terms on caching, display, attribution and derivative data. Quote the exact clauses in the memo.
- [ ] Confirm auth: client id/secret, token exchange, token lifetime and required headers.
- [ ] Capture one authenticated search and one song lookup. Redact the token and any personal data. Record status codes, response shape and rate-limit headers.
- [ ] Record what Genius adds over local tags and Audiometa: annotations, relationships, release data, artwork. Mark anything unavailable or licence-restricted.
- [ ] Ruling: adopt only if it adds unique metadata value and the terms allow the intended cache and display. Drop if it duplicates Audiometa or only exists to reach lyrics.
- [ ] Update `docs/spec.md` only after the memo is reviewed.

**Acceptance:** memo with verdict, a real captured request, terms quotes, and no lyrics plan.

---

### Task 2: Radio Browser spike

**Files:**
- Create: `docs/research/v4-radio-browser-memo.md`
- Create: `docs/research/samples/radio-search.json` and `radio-stations.txt` (redacted)
- Optional spike only, not committed to the app: `docs/research/spikes/radio-playback.md`

**Interfaces:**
- Candidate client shape for the memo: `discoverServers(): Promise<string[]>`, `searchStations(query): Promise<RadioStation[]>`, `reportClick(stationUuid): Promise<void>`.

- [ ] Resolve servers through `all.api.radio-browser.info` DNS. Record the returned hosts and the fallback order.
- [ ] Call `/json/stations/search` with a descriptive User-Agent and a small query. Record fields, icon URLs, tags, country filters and station UUID stability.
- [ ] Test playback of at least three codecs (MP3, AAC, OGG) with `AudioPlaylist` using a live-stream source and `isLiveStream: true`. Record which codecs and redirects work, and what happens when a stream stalls or drops.
- [ ] Confirm `/json/url/<uuid>` click reporting and whether it is required or expected.
- [ ] Check terms, attribution, rate limits, caching rules and whether a proxy is needed for CORS on web.
- [ ] Decide the surface: a separate Radio section inside Catalog, a dedicated tab, or drop. Default: separate section, never mixed into the local queue.
- [ ] Ruling: ship only if stream playback is reliable with the existing playlist engine, offline local playback is untouched, and the discovery UI is small.
- [ ] Update `docs/spec.md` only after the memo is reviewed.

**Acceptance:** memo with verdict, evidence for at least one real stream per adopted codec, failure behavior, and a surface decision.

---

### Task 3: Audiometa.io spike

**Files:**
- Create: `docs/research/v4-audiometa-memo.md`
- Create: `docs/research/samples/audiometa-enrich.json` (redacted)
- Create: `docs/research/samples/audiometa-match-sample.csv`

**Interfaces:**
- Candidate client shape for the memo: `lookupTrack(input: { title: string; artist: string; album?: string; isrc?: string }): Promise<AudiometaTrack | null>`.

- [ ] Create a developer account and inspect the REST endpoints, auth header and response envelope.
- [ ] Record the fields that matter: credits, ISRC, BPM, key, genres, playcounts, social links, artwork and attribution requirements.
- [ ] Record rate limits, caching terms, commercial-use terms and catalogue gaps.
- [ ] Build a 20-track sample from the user's own library. For each, record whether a match exists and whether the returned title/artist/album agree with the local tags. Put the result in `audiometa-match-sample.csv`.
- [ ] Classify mismatches: no match, wrong version, wrong artist, incomplete metadata. Decide whether a confidence threshold or manual confirmation is needed.
- [ ] Ruling: adopt as an optional "Enrich metadata" action, defer until the catalogue improves, or drop. Never make enrichment automatic.
- [ ] Update `docs/spec.md` only after the memo is reviewed.

**Acceptance:** memo with verdict, sample-match evidence, rate limits and a cache policy.

---

### Task 4: Shuffle and source-scope check

**Files:**
- Create: `docs/research/v4-shuffle-scope.md`

- [ ] Local shuffle is already a v3 feature; confirm nothing in v4 changes its semantics.
- [ ] If Radio Browser ships, define whether one shuffle control covers local plus radio or stays source-scoped. Default: source-scoped, no cross-source mixing.
- [ ] Record how repeat and "next" behave at the end of a radio source.
- [ ] Verdict in the memo; no code.

---

### Task 5: Decision review and spec update

**Files:**
- Modify: `docs/spec.md` (v4 section and External services)
- Modify: `docs/superpowers/plans/2026-11-13-v4-discovery-exploration.md` (status and rulings)

- [ ] Review all memos together. Check for duplicate value, conflicting terms and added privacy surface.
- [ ] For each source write one line in the spec: adopt/defer/drop, surface, data sent, cache, attribution.
- [ ] Adopt at most one new source per v4 implementation slice. Prefer the smallest slice that proves value.
- [ ] Record the reviewed date and the reviewer in each memo.
- [ ] Commit `docs: record v4 discovery verdicts`.

**Acceptance:** a reader can tell from the spec alone which sources ship, where they appear, what leaves the device, and what happens offline.

---

### Task 6: Conditional implementation slices (only after a reviewed adopt)

Do not start this task from the research plan. It is a skeleton for the next
plan once Task 5 names an adopted source.

**For an adopted metadata source (Genius or Audiometa):**
- [ ] Create `src/discovery/<source>.ts` with the reviewed client, timeout, typed errors, cache and attribution.
- [ ] Create one opt-in surface: a track action "Enrich metadata" or a read-only details section. Never write tags without the Task 5 confirmation.
- [ ] Add the Settings switch, the data-sent copy and the cache clear action.
- [ ] Tests: response mapping, empty/partial data, 401/429/5xx, cache hit and cache expiry.
- [ ] Verify offline: the action is disabled or shows a clear offline message; local playback is unchanged.

**For adopted Radio Browser:**
- [ ] Create `src/discovery/radio.ts` with server discovery, search, click reporting and cache.
- [ ] Create a separate Radio section with search, station rows, play/stop and a now-playing line. It uses `AudioPlaylist` with `isLiveStream: true` and never joins the local queue.
- [ ] Failure states: station offline, stream stalled, codec unsupported, resolver/server list empty.
- [ ] Tests: response mapping, UUID stability, offline behavior, cache expiry.
- [ ] Verify local playback still works with radio stopped, failed or never used.

**For a dropped source:**
- [ ] Record why in the memo and the spec. Do not add a disabled placeholder that implies support.

---

## Acceptance

- A written verdict for Genius, Radio Browser and Audiometa, each with a real captured request or a documented reason none was possible.
- Terms, cost, rate limits, data sent, cache, attribution and failure behavior in every adopted memo.
- Local-first playback unchanged offline; no discovery surface blocks app start.
- No new dependency or network call lands without the reviewed verdict.
- The spec names only adopted items, with surface and privacy behavior.
