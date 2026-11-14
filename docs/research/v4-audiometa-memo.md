# Audiometa.io Decision Memo

**Verdict:** defer
**Date:** 2026-11-14
**Evidence:**
- Homepage: https://audiometa.io/ (fetched 2026-11-14)
- OpenAPI: https://api.audiometa.io/v1/openapi.json (captured verbatim in
  `docs/research/samples/audiometa-openapi.json`)
- `docs/research/samples/audiometa-no-key-401.json`
- `docs/research/samples/audiometa-terms-gap.md`
- No authenticated response was captured: no API key was available.
- No 20-track local-library match sample was produced: neither an API key nor
  the user's on-device tags were available in this worktree.

## What it gives

From the OpenAPI document (v1.0.0):

- `GET /v1/search` across artists, albums and tracks by free-text query.
- `GET /v1/artists/{id}`, albums, tracks, top tracks, related artists.
- Browse tracks by key, tempo range and record label.
- Track fields: name, artists, duration, explicit flag, popularity, preview
  URL, disc/track number, external URLs, images, external IDs, album, nullable
  Spotify/YouTube/SoundCloud playcounts.
- Audio features (all nullable): tempo, key, mode, energy, danceability,
  valence, loudness, time signature.
- Artist fields: images, popularity, genres, country code, bio, external IDs,
  followers, and social stats for Spotify, YouTube, Instagram, TikTok,
  SoundCloud and Facebook.
- Album fields: label, UPC, album type, release date and precision, artwork,
  track paging.
- Stable Audiometa IDs (`amart_`, `amalb_`, `amtrk_`) and URI/href links.

This is the richest metadata set of the three sources for BPM, key, playcounts,
genres, artwork and release data.

## What it does not give

- No lyrics.
- No direct ISRC lookup. `/v1/tracks` and `/v1/albums` take Audiometa IDs, not
  ISRCs; `/v1/search` is free text. A local file's ISRC cannot be sent as a
  lookup key, so matching must go through title/artist search and ranking.
- No dedicated match/confidence endpoint. The caller must compare the returned
  title, artist and album against local tags.
- No published terms, privacy policy, licence or attribution requirement (see
  below).
- No guarantee of completeness. The site says the catalogue is "still seeding";
  audio features and playcounts are nullable.
- No proof that artwork or external IDs are licensed for display in Krotify.
  They appear to be aggregated from Spotify, YouTube and SoundCloud, whose own
  terms may apply.
- No lyrics field in the v1 OpenAPI, even though the `/contribute` page invites
  users to add lyrics. Do not use any Audiometa lyrics; LRCLIB remains the only
  lyrics source.

Candidate client shape for a future spike, not implemented:

```ts
lookupTrack(input: {
  title: string;
  artist: string;
  album?: string;
  isrc?: string;
}): Promise<AudiometaTrack | null>;
```

The `isrc` input is a local matching hint only; it cannot be sent to the API as
a lookup key.

## Terms and legal notes

No public terms were found. `https://audiometa.io/terms`,
`/terms-of-service`, `/tos`, `/legal`, `/privacy`, `/about` and `/faq` all return
404; the static sitemap lists no legal page; and the OpenAPI document has no
`termsOfService` or licence field. The site footer says "© 2026 Audiometa. All
rights reserved."

The homepage says the service is "completely free", has "no paid tiers", and is
"built for products", but that is marketing copy, not a licence. Unresolved:

- Whether responses may be cached on device and for how long.
- Whether artwork may be displayed, and what attribution is required.
- Whether commercial use is allowed.
- Where the data comes from and whether redistribution is permitted.
- What happens to cached data after an API key is revoked.

Because the data is aggregated from third-party platforms, the absence of terms
is a blocker, not a green light. A memo cannot approve a cache or display policy
from silence.

## Auth, cost and rate limits

- Base URL: `https://api.audiometa.io/v1`.
- Auth: `Authorization: Bearer amsk_...` or `x-api-key: amsk_...`.
- Create keys at `https://audiometa.io/dashboard/api`; up to 3 keys per account;
  the raw secret is shown only at creation or rotation.
- Cost: free, no paid tiers advertised.
- Rate limit: 100 requests per minute per key, 60-second window, all `/v1`
  endpoints. Exceeding it returns HTTP 429.
- Error envelope: `{ "error": { "status": 401, "message": "..." } }`.
- Paging: `limit` default 20, max 50 unless noted, `offset` for the rest.
- 401 without a key was captured. 429 headers and behavior could not be observed
  without a key.

## Data sent from the device

- Search query text (typically local title and artist), entity type filters, and
  Audiometa IDs.
- The API key, which identifies the app installation or the developer account.
- No file paths, listening history, playlists or device identifiers need to
  leave the device.
- The UI must name the sent fields and show that the key is the app's, not the
  user's account.

## Cache and offline behavior

- No Audiometa data offline. Enrichment is an online action.
- The v4 spec already recommends aggressive caching because the catalogue is
  incomplete. That policy is blocked until terms are published.
- Candidate policy if approved: store only the fields shown in the UI, with a
  30-day TTL, a clear-cache action, and no automatic refresh in the background.
- Never write returned metadata into files automatically. Enrichment is a
  read-only preview with manual confirmation.
- Local playback, search and imports must be unchanged when enrichment is
  disabled, offline or failing.

## Failure behavior

- 401: treat the key as missing/invalid; show "Enrichment is not configured" and
  do not retry in a loop.
- 403: hide enrichment.
- 404: no match; keep local tags.
- 429: honor the wait, back off, and show a quiet unavailable state.
- 5xx, timeout or malformed JSON: hide the enrichment card; leave local content
  untouched.
- Null audio features or playcounts: omit those rows, never show "0" or "Unknown"
  as if it were data.
- Partial match: show the candidate and require confirmation; never overwrite
  tags automatically.

## UX surface

An opt-in "Enrich metadata" action in the track action sheet, opening a
read-only preview sheet:

- Local tags on one side, Audiometa candidate on the other.
- BPM, key, genres, release date, label, playcounts, artwork where available.
- A confidence note when title, artist or album disagree.
- A manual "Use these details" step is out of scope for the first slice; the
  first slice only displays and links out.
- Attribution wording is undecided until Audiometa publishes a requirement.

## Smallest shippable slice

There is no approved slice yet. The candidate slice, after a key and terms:

1. Settings opt-in with data-sent copy and a cache-clear action.
2. One track action: search by local title + artist, rank candidates, show the
   best match in a read-only preview.
3. Display a small fixed set: title, artist, album, year, BPM, key, genres.
4. Cache the match for 30 days with a visible "cached" note.
5. No tag writes, no artwork replacement, no automatic enrichment, no batch
   operation.

## Why this verdict

Defer, not adopt: the API shape is attractive and the OpenAPI document is real,
but there is no key, no authenticated response, no match sample and no published
terms. The most valuable fields (BPM, key, playcounts) are nullable, and the
catalogue is explicitly incomplete. Adopting now would mean guessing at both
match quality and legal permission.

Defer, not drop: Audiometa offers data the local library and Genius do not
(BPM, key, cross-platform playcounts), and the free tier is workable if the
terms allow caching and display.

## Follow-ups before code

1. Create a free Audiometa account and one API key at
   `https://audiometa.io/dashboard/api`; keep it out of the repo.
2. Obtain the terms of service, privacy policy, attribution requirement,
   caching policy and commercial-use position from the operator. A public URL or
   written answer is required.
3. Capture one authenticated search, one track lookup and one 404; record status
   codes, rate-limit headers and the exact response envelope.
4. Build the 20-track `audiometa-match-sample.csv` from the user's real library:
   match/no match, title/artist/album agreement, and mismatch class.
5. Decide the confidence threshold or require manual confirmation.
6. If terms or match quality fail, change the verdict to drop.
