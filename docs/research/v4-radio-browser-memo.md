# Radio Browser Decision Memo

**Verdict:** adopt
**Date:** 2026-11-14
**Evidence:**
- API docs: https://api.radio-browser.info/ and
  https://de1.api.radio-browser.info/ (server version 0.7.50, fetched 2026-11-14)
- `docs/research/samples/radio-servers.json` — live `GET /json/servers`
- `docs/research/samples/radio-search.json` — live `GET /json/stations/search`
- `docs/research/samples/radio-search-request.txt` — URL, User-Agent, headers
- `docs/research/samples/radio-stations.txt` — MP3/AAC/OGG result rows
- `docs/research/samples/radio-click.json` — live `GET /json/url/<uuid>`
- `docs/research/samples/radio-codec-probe.txt` — stream HTTP probes

**Adoption gate:** before any UI code, a real-device smoke test must play one
MP3, one AAC and one OGG/Opus station through the existing `expo-audio` path,
and recover from one stopped stream. If that fails, change this verdict to drop.

## What it gives

A free, public directory of internet radio stations.

- Server discovery through `all.api.radio-browser.info` DNS, or the
  `_api._tcp.radio-browser.info` SRV record. The live JSON endpoint returned
  `de1.api.radio-browser.info` over IPv4 and IPv6.
- `GET /json/stations/search` with filters for name, tags, country/countrycode,
  language, codec, bitrate, and paging via `limit`/`offset`; sort with
  `order`/`reverse`; hide broken stations with `hidebroken=true`.
- Station fields: `stationuuid` (stable across servers), `name`, `url`,
  `url_resolved` (playlists and redirects already resolved), `homepage`,
  `favicon`, `tags`, `countrycode`, `language`, `votes`, `codec`, `bitrate`,
  `hls`, `lastcheckok`, `lastchecktime`, `clickcount`, geo fields.
- `GET /json/url/<stationuuid>` click reporting, which returns the station name
  and resolved stream URL.
- Station lists by clicks, votes, recent click and recent change for a simple
  "popular" or "recent" default view.
- CORS is open (`access-control-allow-origin: *`), so web builds can call the
  API directly.

Live capture: a `name=jazz` search returned three stations with MP3, AAC and
other codecs; click reporting returned
`{"ok":true,"message":"retrieved station url",...}`.
HTTP probes reached real streams:

| Codec | Probe result |
| --- | --- |
| MP3 | 200, `content-type: audio/mpeg` |
| AAC | 200, `content-type: audio/aac`, `icy-br: 192` |
| OGG/Opus | 200, `content-type: audio/ogg` |

## What it does not give

- No guarantee of uptime or audio quality. The docs say the service is "without
  guarantee to work", and the directory only marks stations with
  `lastcheckok`; it cannot prevent a stream dying mid-song.
- No now-playing metadata guarantee. Some Icecast streams expose `icy-*`
  headers, but the directory API does not provide a current track.
- No lyrics, no local-library metadata, no playlists, no favourites API.
- No offline playback. Radio is online-only by nature.
- No single stable server. Direct links to one server are explicitly
  discouraged; the client must discover, randomize and retry.
- No cross-server numeric `id` use. IDs are server-local; use `stationuuid`.
- No formal terms-of-service or licence page was found in the server docs, only
  the freedom statement quoted below.

## Terms and legal notes

The root API docs state:

> This API ... is completely free and open source. Your freedoms are: You may
> use it in free and non free software. You may install it on your own server
> and mirror all its data. You may fork it.

The server docs state:

> This webservice can be used freely but without guarantee to work. I have been
> keeping it online since December, 2015, but downtimes are possible...

> Please send a descriptive User-Agent in your HTTP requests, which makes it
> easier for me to get in touch with developers to help with the usage of the
> API.

> Send /json/url requests for every click the user makes, this helps to mark
> stations as popular and makes the database more usefull to other people.

> Do NOT use the "id" fields anymore! They do not work accross multiple servers.
> Use the uuid fields instead (e.g.: stationuuid, checkuuid, clickuuid). These
> fields are kept consistend accross servers in the network.

> Never use a direct link to a single new server. It is much better to get a
> list of the servers like described above.

No formal ToS, privacy policy, attribution clause or rate-limit number was
published on the fetched pages. The API itself is free; the audio streams are
third-party content with their own rights. Krotify should:

- Credit Radio Browser in the Radio section and link to
  `https://www.radio-browser.info/`.
- Link each station to its `homepage` so users can see the broadcaster's terms.
- Not download, record or redistribute streams.
- Send the required descriptive User-Agent on every request.
- Report a click when the user starts a station.

## Auth, cost and rate limits

- No auth, no API key, no account. Cost: free.
- No published numeric rate limit. The docs say "used freely but without
  guarantee"; treat that as an obligation to be polite, not as unlimited.
- Practical policy: one search per explicit user action, `limit` 20–50, cache
  results, send requests sequentially, do not poll, do not prefetch station
  lists in the background.
- On failure, retry once against the next discovered host, then stop.
- Do not hardcode `de1`; discover through DNS, randomize, and remember the last
  working host only as a fallback.
- `GET /json/url/<uuid>` is a normal request per station start, not a loop.

## Data sent from the device

- The search query the user typed, plus explicit filters (codec, country,
  language).
- The station UUID on click reporting.
- A User-Agent that identifies the client and version, not the user:
  `User-Agent: Krotify <version> (https://github.com/Krocified/krotify)`.
- No account, device ID, listening history, local file names or location
  permission data. Geo fields in responses are station metadata, not the user's
  location.
- The UI must say what is sent before the first search: "Your search text is
  sent to the Radio Browser directory."

## Cache and offline behavior

- Server list: cache in memory or SQLite for about 1 hour; refresh on a failed
  request.
- Search results: cache for about 24 hours keyed by query + filters; show a
  "cached" note when stale.
- Station metadata (favicon, homepage, tags): cache for about 7 days; artwork
  URL failures fall back to a generated cover.
- Never cache audio. Radio is online-only.
- Offline: show cached results with an "offline, showing cached stations" note,
  or a clear empty state. Play/stop is disabled with a recoverable message.
- Local playback, library, imports and playlists must be identical when radio
  has never been used, is offline or has failed.
- Settings needs a "Clear radio cache" action if a persistent cache ships.

## Failure behavior

- DNS or `/json/servers` empty: fall back to the last working host; if none,
  show "Radio is unavailable" and keep local playback untouched.
- 5xx, timeout or connection reset: retry the next host once, then surface a
  quiet offline state.
- Stream 403/404/410 or `lastcheckok=0`: mark the station "Offline" and offer a
  retry, not an automatic loop.
- Unsupported codec (for example HLS not supported on the platform): show
  "This station's format is not supported here".
- Stall or mid-stream drop: stop, show "Stream dropped — retry", and never
  auto-advance into the local queue. `AudioPlaylist` may report
  `didJustFinish` when a stream ends; the radio controller must treat that as a
  stop, not a queue advance.
- Redirects and playlists: use `url_resolved` first; fall back to `url`.
- A radio failure must never wedge the local player or change its queue.

## UX surface

**Decision: a separate Radio section inside Catalog**, not a new tab. It stays
visually distinct from local Albums/Artists and never mixes into the local queue.

- Search field and a short result list: favicon, station name, country, codec,
  bitrate, online/offline chip.
- One primary action per row: Play / Stop. No add-to-queue, no favourite, no
  download in the first slice.
- A single now-playing line for radio, separate from the local mini-player.
- Attribution footer: "Radio directory by Radio Browser" with a link, plus a
  station homepage link.
- Empty, loading, offline and station-offline states are designed, not raw
  errors.

Technical note: the v4 plan proposes `AudioPlaylist` with
`isLiveStream: true`. In the Expo SDK 58 docs, `isLiveStream` exists only on
`AudioLockScreenOptions`, not on `AudioSource` or `AudioPlaylistOptions`. For a
single continuous stream, a dedicated `expo-audio` `AudioPlayer` is the smaller
and more honest fit. Use a playlist only if station hopping is added later. This
must be settled in the device smoke test before UI code.

## Smallest shippable slice

1. Add a "Radio" section to Catalog, collapsed by default and opt-in on first
   open.
2. Discover hosts, search by station name, show 20 results, play/stop one
   station in a dedicated `AudioPlayer` (or a one-item playlist if the device
   test requires it).
3. Show a now-playing line with station name and codec/bitrate.
4. Report a click when playback starts; send the Krotify User-Agent.
5. Cache the host list and search results; clear-cache action in Settings.
6. Failure states: no hosts, offline, station offline, unsupported codec,
   stream dropped.
7. No local queue changes, no favourites, no downloads, no cross-source shuffle,
   no background-radio promise until the smoke test proves it.

## Why this verdict

Adopt because it is the only source in this round with real, unauthenticated
evidence: live host discovery, live search, live click reporting, open CORS, and
real MP3, AAC and OGG streams reachable over HTTP. It adds a genuinely new
listening mode without touching the local library, and the smallest slice is one
screen and one player.

The remaining risk is not the API; it is on-device playback through
`expo-audio`, especially live-stream duration, buffering, reconnect and
background behavior. That is why adoption is gated on the device smoke test. If
the gate fails, drop radio rather than ship a fragile surface.

## Follow-ups before code

1. On a real Android device, play one MP3, one AAC and one OGG/Opus station with
   `expo-audio`; record time-to-first-audio, buffering, duration behavior,
   `didJustFinish`, and recovery after a forced network drop.
2. Test whether a dedicated `AudioPlayer` or a one-item `AudioPlaylist` is the
   correct primitive; confirm the `isLiveStream` lock-screen option and whether
   background radio is in scope.
3. Test one HLS (`.m3u8`) station on Android and web; decide whether to filter
   HLS out of results if unsupported.
4. Confirm DNS discovery and fallback order on a device, including IPv6-only
   failure.
5. Decide cache TTLs and the privacy copy.
6. Add the Radio Browser attribution and station-homepage link.
7. Measure request volume against the "used freely" expectation; keep search
   manual, capped and cached.
