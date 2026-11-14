# Genius Decision Memo

**Verdict:** defer
**Date:** 2026-11-14
**Evidence:**
- API docs: https://docs.genius.com/ (fetched 2026-11-14)
- Terms: https://genius.com/static/terms ("Last Updated: January 13, 2026")
- `docs/research/samples/genius-api-surface.md`
- `docs/research/samples/genius-terms-excerpt.md`
- `docs/research/samples/genius-no-token-401.json`
- No authenticated search or song response was captured: no `client_id`,
  `client_secret`, or generated client access token was available.

## What it gives

Documented read resources: song lookup by Genius ID, artist lookup and artist
songs, search over Genius-hosted songs, annotations, referents, web-page lookup,
and account data for a user token.

Compared with local tags, Genius can add:
- Genius song and artist identity (IDs, canonical names).
- Annotation and referent relationships attached to a song or web page.
- Search over the Genius catalogue, not just the local library.

Compared with Audiometa, the distinctive value is editorial annotations and
referents. Basic song/artist identity and search overlap with Audiometa and with
local tags. The fetched docs do not enumerate the full song JSON, so release
dates, artwork and relationship fields could not be verified without a token.

Candidate client shape for a future spike, not implemented:

```ts
searchSong(query: string): Promise<GeniusHit[]>;
getSong(id: string): Promise<GeniusSong>;
```

## What it does not give

- No lyrics payload for playback. The public API is metadata and annotations;
  the v4 plan forbids scraping Genius web pages for lyrics.
- No documented ISRC, BPM, key, playcounts or audio features.
- No unauthenticated access. Every call needs a token.
- No verified response shape, field coverage or rate-limit headers, because no
  token was available.
- No caching, offline-display or derivative-data licence in the terms.

## Terms and legal notes

The API docs state:

> Commercial use of the Genius API is not allowed without a license. Please
> reach out to api-sales@genius.com to discuss commercial usage.

The Terms of Service "Commercial Use" clause prohibits using, displaying,
distributing, licensing, publishing, reproducing, creating derivative works
from, modifying, selling or transmitting any portion of the Service or Genius
Content for commercial purposes or machine-learning purposes without express
written consent, and says "The Service is for your personal use."

The intellectual-property clause also prohibits modifying, copying, framing,
scraping, distributing or creating derivative works based on the Service or
Genius Content, and prohibits data mining, robots, scraping or similar
extraction.

Implications:
- A free, personal, open-source app is closer to "personal use" than a
  commercial product, but Genius has not confirmed that in writing. Treat the
  commercial-use question as unresolved.
- Caching annotations, artwork or metadata locally is a copy/derivative use that
  the terms do not expressly license. A persistent offline cache is therefore
  not approved.
- Annotations are commentary about lyrics. Displaying them may still reproduce
  or derive from the lyric document, which Krotify does not licence.
- No scraping fallback. LRCLIB remains the lyrics source.
- Attribution is not specified for API metadata; do not invent a credit line
  until Genius confirms one.

## Auth, cost and rate limits

- OAuth2. Register an API client to get `client_id` and `client_secret`.
- Read-only, non-user endpoints can use a client access token generated on the
  API Client management page. User-specific endpoints need the authorization
  code flow and scopes.
- Requests use `Authorization: Bearer <token>` over HTTPS.
- Cost: free for permitted non-commercial use; a licence is required for
  commercial use.
- Rate limits: not published in the fetched docs. The unauthenticated probe
  returned 401; no 429 or rate-limit headers were observed. Limits must be
  measured after a token is issued.
- Token lifetime: not stated in the fetched docs; must be confirmed.

## Data sent from the device

- Search query text (`q`), song/artist IDs, and any requested `text_format`.
- The access token. With a client token this identifies the app, not the user;
  with a user token it identifies the authorizing Genius account.
- No listening history, file paths, device IDs or local library contents need to
  leave the device.
- The UI must name the query and token use before the first call.

## Cache and offline behavior

- No Genius data offline. The feature is unavailable without network.
- Terms do not grant a persistent cache. Until Genius confirms, the safe default
  is an in-memory, session-only response with no disk cache.
- If a cache is later approved, store only the minimum fields, show attribution,
  provide a clear-cache action, and never store lyrics.
- Local library, playback, imports and search must work identically with Genius
  disabled or offline.

## Failure behavior

- 401: show "Genius is not configured" or "sign-in required"; never retry in a
  loop, never expose the token.
- 403 / 404: treat as no metadata for that track.
- 429: honor the wait, back off, and show a quiet unavailable state.
- 5xx, timeout or malformed JSON: hide the Genius section and leave local
  content unchanged.
- Empty search or partial fields: render only present fields; no placeholder
  text that implies data.
- A failed request must never block first paint or the local player.

## UX surface

A read-only, opt-in details section on a track, for example "About this song"
under the local details. It shows only verified metadata and, if legally
approved, annotation links. It never shows lyrics, never writes tags, and never
changes the local queue.

Attribution: "Metadata from Genius" with a link to the Genius song page, pending
Genius confirmation of the required wording.

## Smallest shippable slice

There is no approved slice yet. The candidate slice, after credentials and
legal review, is:

1. A Settings opt-in for "Genius metadata" with data-sent copy.
2. One track action that searches by local title + artist and resolves the top
   song.
3. A read-only card with verified fields and a link to the Genius page.
4. No annotation display, no cache, no tag writes, no lyrics, until the terms
   question is answered.

## Why this verdict

Defer, not drop: annotations are a genuinely different kind of data, but the
spike could not capture a single authenticated response, the song response
shape is unverified, the commercial-use and derivative-work terms are
restrictive, and the useful metadata overlaps Audiometa and local tags. Shipping
on guesses would violate the "no fabricated evidence" rule.

Defer, not adopt: the exact blockers are a Genius API client and token, plus a
written answer on personal/open-source use, caching and annotation display.

## Follow-ups before code

1. Create a Genius API client at https://genius.com/api-clients.
2. Generate a client access token and store it outside the repo (local env or
   secret manager). Never commit it.
3. Capture `GET /search?q=...` and `GET /songs/:id`, record status codes,
   response shape and any rate-limit headers. Redact the token.
4. Record the exact song fields available (artwork, release date, relationships)
   and compare them with Audiometa and local tags.
5. Ask Genius (api-sales@genius.com) in writing whether a free personal
   open-source player may cache and display song metadata and annotations, and
   what attribution is required.
6. If the answer is no, change the verdict to drop. If yes, return with a
   reviewed slice and a privacy copy.
