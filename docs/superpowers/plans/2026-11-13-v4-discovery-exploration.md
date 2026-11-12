# v4 Discovery Exploration Plan

**Status:** research and legal spikes only. Nothing here is committed to ship.

**Spec:** `docs/spec.md` v4 section.

**Goal:** Decide, with evidence, whether Krotify adds external discovery:
Genius metadata, Radio Browser internet radio, and Audiometa.io catalogue data.
Each gets an adopt/defer/drop ruling with cost, legal notes and a fallback.

## Guardrails

- Local playback must keep working with no network and no account.
- Every external surface is opt-in and clearly separated from the local library.
- Identify the client in requests, honor rate limits, cache responses, show
  attribution, and never scrape a web page for data the API does not provide.
- No lyrics from Genius; LRCLIB remains the lyrics source.

## Task 1: Genius spike

- [ ] Read the current Genius API docs and confirm what the public API actually
  returns: song/artist metadata, annotations, no lyrics payload.
- [ ] Check the developer terms on lyrics, caching and display.
- [ ] Prototype one authenticated search plus song lookup; record rate limits and
  auth (client token/secret) requirements.
- [ ] Ruling: is there enough metadata value over the local tags and Audiometa?
  Likely drop unless it adds something unique, and never use it for lyrics.

## Task 2: Radio Browser spike

- [ ] Fetch the server list via DNS (`all.api.radio-browser.info`) and call
  `/json/stations/search` with a descriptive User-Agent.
- [ ] Confirm stream playback compatibility for a few codecs (MP3, AAC, OGG) and
  what happens when a station drops or redirects.
- [ ] Check icons, tags, country filters, station UUID stability and the
  `/json/url` click reporting endpoint.
- [ ] Decide the surface: a separate Radio tab, a Catalog section, or drop.
- [ ] Ruling: ship only if streaming works with the playlist engine, offline
  local playback is untouched, and the discovery UX is small.

## Task 3: Audiometa.io spike

- [ ] Create a developer account, inspect the REST endpoints and auth header.
- [ ] Check fields that matter: artist/track credits, ISRC, BPM, key, genres,
  playcounts, social links, and their attribution requirements.
- [ ] Check rate limits, caching terms and catalogue gaps for the user's own
  library; measure match quality on a sample of 20 local tracks.
- [ ] Ruling: adopt as an optional "enrich metadata" action, or defer.

## Task 4: Shuffle scope check

- [ ] Local shuffle is a v3 feature and does not belong here.
- [ ] If radio ships, define whether a single control shuffles local plus radio
  or stays source-scoped. Default: source-scoped, no cross-source mixing.

## Task 5: Decision memo

- [ ] One page per API: what it gives, terms, cost, rate limits, UX, verdict
  (adopt/defer/drop), and the smallest shippable slice.
- [ ] Update `docs/spec.md` milestones with only the adopted items.
- [ ] No implementation until the memo is reviewed.

## Acceptance

- A written verdict for Genius, Radio Browser and Audiometa.
- Evidence of at least one real request per adopted API.
- Local-first playback unchanged offline.
- No new dependency or network call lands without the verdict.
