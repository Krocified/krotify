# v7 LRCLIB exploration

Status: exploration only. Local `.lrc` files are the v7 baseline; nothing here is
shipped by default.

Source: https://lrclib.net/docs (fetched 2026-11-17).

## What the API offers

- Base URL `https://lrclib.net`, CORS enabled.
- `GET /api/get` matches a track. Requires `track_name` and `artist_name`;
  `album_name` and `duration` (seconds) improve the match. A duration within
  +/- 2 seconds is treated as the same track. Returns 404 when nothing matches.
- `GET /api/get/{id}` returns one record by LRCLIB id.
- `GET /api/search` searches by `q` or `track_name`, with optional
  `artist_name` / `album_name`; up to 20 results, no pagination.
- `GET /api/v2/search` (beta) returns lightweight metadata without lyrics text.
  Fetch the chosen record with `/api/get/{id}`.
- Record fields: `trackName`, `artistName`, `albumName`, `duration`,
  `instrumental`, `hasWordSync`, `plainLyrics`, `syncedLyrics` (LRC) and a raw
  `lyricsfile`. `syncedLyrics` maps directly to the existing LRC parser.
- `POST /api/publish` and `POST /api/flag` need a proof-of-work token. Out of
  scope.

## Client requirements

- Identify the client with `User-Agent` (name, version, project URL or email) or
  `X-User-Agent` / `Lrclib-Client` where the header cannot be set.
- Rate limits are per IP: roughly 45/min unidentified, 90/min identified.
  Registration gives more but is optional.
- On `429`, honor `Retry-After` and add jitter. Edge rejections may not be JSON;
  check the status code and `Retry-After` first.
- Send requests sequentially and add a 200-500 ms delay between them.
- Cache results so repeat opens do not hit the network.

## What already exists

`src/library/lrclib.ts` and `tests/lrclib.test.ts` already implement the previous
v3 lookup: `GET /api/get`, the required User-Agent, sequential requests with a
delay, `429` handling, a timeout, and a local cache. The lyrics panel and parser
remain on disk, gated by `LYRICS_ENABLED`. Bringing the network path back is a
toggle and a UI decision, not a new client.

## Proposed v7 behavior if adopted

- Local `.lrc` always wins. Network lookup only runs when the user opts in and
  no local lyrics exist.
- Off by default. If enabled, a single Settings switch; the song page keeps the
  Import .lrc action.
- Send only title, artist, album and duration. No file names, paths or artwork.
- One request per opened track, sequential, cached locally. No prefetching, no
  library-wide batch.
- Show source and cache state in the lyrics panel. Offline after the first fetch.
- No publish, flag or account. Registration with LRCLIB is unnecessary at this
  scale.

## Gate

Do not ship the network path until:

1. The privacy trade-off is accepted (title, artist, album and duration leave the
   device).
2. The existing client is re-verified against the current API, including 429 and
   timeout behavior.
3. The UI clearly distinguishes local lyrics from network lyrics.
4. A device test confirms the lookup does not block playback or the library.

If the gate is not cleared, v7 ships local `.lrc` only.

## Open questions

- Is an app registration (`Lrclib-App-Id`) worth it for higher limits, given the
  one-lookup-per-track design?
- Should a network result be cached as if it were a local import, or stored with a
  visible source and a refresh action?
- How should a network lookup failure surface without turning lyrics into an
  error path?
