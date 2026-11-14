# Link Import Resolver Decision Memo

**Verdict:** ship disabled. Reject the self-hosted yt-dlp resolver and the
licensed converter API. Keep `LINK_IMPORT_ENABLED = false`, show a disabled
section with a clear rights note, and stop.
**Date:** 2026-11-14
**Task:** v3 Task 11, branch `feat/link-spike`
**Scope:** decision artifact only. No client, no dependency, no downloads, no
YouTube scraping.

**Evidence (fetched 2026-11-14):**
- YouTube Terms of Service: https://www.youtube.com/t/terms
- YouTube API Services Developer Policies (last updated 2026-11-06):
  https://developers.google.com/youtube/terms/developer-policies
- YouTube developer policy guide:
  https://developers.google.com/youtube/terms/developer-policies-guide
- yt-dlp README: https://github.com/yt-dlp/yt-dlp
- cobalt API docs: https://github.com/imputnet/cobalt/blob/main/docs/api.md
- cobalt instance docs:
  https://github.com/imputnet/cobalt/blob/main/docs/run-an-instance.md
- cobalt license/ethics: https://github.com/imputnet/cobalt
- Google Play Intellectual Property policy:
  https://play.google/developer-content-policy/#intellectual-property

## Decision

Ship the Import tab's link section disabled. Do not add
`src/library/linkImport.ts` network code, a resolver dependency, a server, or
any YouTube scraping.

The blocker is authorization, not missing technical evidence. No resolver in
scope is permitted to download YouTube audio, and a user rights checkbox cannot
grant permission that YouTube withholds.

"Defer" is the wrong verdict here. Defer implies a known path with missing
evidence. There is no licensed resolver to wait for, and no evidence that would
make yt-dlp compliant. Re-open only if a condition in "What would change this
verdict" is met.

## Options evaluated

| Option | What it is | Legal/terms | Operations | Verdict |
| --- | --- | --- | --- | --- |
| A. Self-hosted yt-dlp | HTTP wrapper around `yt-dlp -J` and download on a server you run | Violates YouTube terms unless prior written permission; bypasses restrictions; anti-circumvention risk | Server, bandwidth, JS runtime, cookies or PO tokens, IP blocks, frequent breakage | Reject |
| B. Self-hosted OSS resolver (cobalt) | AGPL resolver; `POST /` returns tunnel, redirect or local-processing data | Same YouTube authorization problem; hosted instance not for third-party use; AGPL obligations if modified | Similar to A; turnstile, API keys, rate limits, tunnels | Reject; useful only as an API-shape reference |
| C. Licensed converter API | Commercial API that claims to convert YouTube links | No vendor found with YouTube's prior written approval; a vendor cannot grant rights it lacks | Per-call cost, quota, opaque reliability | Reject; none exists in scope |
| D. Ship disabled | No network path; local file import only | No new legal exposure | None | **Adopt** |

yt-dlp is a CLI and library, not an HTTP service. "Self-hosted yt-dlp" means
building and operating the wrapper, queue, auth, temp storage, cleanup and
abuse controls yourself.

## Legal and terms constraints

### YouTube consumer terms

The Terms of Service prohibit downloading Content except when the Service
expressly authorizes it or YouTube and the rights holders give prior written
permission:

> You are not allowed to: access, reproduce, download, distribute, transmit,
> broadcast, display, sell, license, alter, modify or otherwise use any part of
> the Service or any Content except: (a) as expressly authorized by the
> Service; or (b) with prior written permission from YouTube and, if
> applicable, the respective rights holders;

They also prohibit bypassing restrictions:

> circumvent, disable, fraudulently engage with, or otherwise interfere with any
> part of the Service (or attempt to do any of these things), including
> security-related features or features that (a) prevent or restrict the copying
> or other use of Content or (b) limit the use of the Service or Content;

And automated access:

> access the Service using any automated means (such as robots, botnets or
> scrapers) except (a) in the case of public search engines, in accordance with
> YouTube's robots.txt file; or (b) with YouTube's prior written permission;

Both a self-hosted resolver and a converter API access YouTube by automated
means and download Content. Neither has the required permission. The public
search-engine exception is narrow and does not apply to Krotify. A user owning a
copy elsewhere does not authorize downloading it from YouTube.

### YouTube API policies

Switching to the official API does not help. The YouTube API Services Developer
Policies state:

> You and your API Clients must not, and must not encourage, enable, or require
> others to: (1) download, import, backup, cache, or store copies of YouTube
> audiovisual content without YouTube's prior written approval, (2) make content
> available for offline playback, or (3) use any aspect of the YouTube API
> Services to facilitate or promote copyright infringement or the exploitation
> of copyright-infringing materials.

The developer policy guide names the audio-extraction case directly. Prohibited
behavior includes:

> Allow users to download videos for offline play outside of the YT Premium
> experience.

> Offer users the ability to download or separate audio tracks or allow users to
> modify the audio or video portions of a video.

The only sanctioned offline path is YouTube Premium inside YouTube's own
experience. There is no official "YouTube to MP3" endpoint, and API credentials
do not turn one into a download permission.

### yt-dlp licensing versus use

yt-dlp's code is permissively licensed:

> While yt-dlp is licensed under the Unlicense, many of the release files
> contain code from other projects with different licenses. Most notably, the
> PyInstaller-bundled executables include GPLv3+ licensed code, and as such the
> combined work is licensed under GPLv3+.

The code license is not the problem. The use against YouTube is. Current full
YouTube support also needs a JavaScript runtime and `yt-dlp-ejs`. The README
documents that some clients need cookies or a PO token, and some clients only
work with authentication. A server would therefore hold cookies or tokens and
impersonate client sessions. That is both operationally fragile and closer to
the circumvention the terms prohibit. ffmpeg is also required for merging and
post-processing and carries its own license.

### cobalt licensing and terms

Cobalt is AGPL-3.0. Its README says:

> cobalt is a tool that makes downloading public content easier. it takes zero
> liability. the end user is responsible for what they download, how they use
> and distribute that content.

And for the hosted API:

> hosted api instances (such as `api.cobalt.tools`) use bot protection and are
> not intended to be used in other projects without explicit permission. if you
> want to use the cobalt api, you should host your own instance or ask an
> instance owner for access.

Hosting it yourself avoids the hosted-instance permission issue but not the
underlying YouTube authorization issue. AGPL also adds source-offer obligations
if you modify it and serve it over a network.

### Store and copyright exposure

Google Play's Intellectual Property policy prohibits apps that infringe or
facilitate infringement. A YouTube downloader surface is a review and takedown
risk. Copyright in the audio remains with the rights holder; a user attestation
is evidence of intent, not a license. Where a resolver bypasses technical
restrictions, anti-circumvention law (for example DMCA section 1201 in the US
and equivalent rules elsewhere) may apply.

This memo is not legal advice. Get counsel before enabling any resolver.

**Bottom line:** a rights gate can make the user attest ownership, but it cannot
cure the platform's terms. That is why the verdict is disabled, not "enabled
with a checkbox."

## Request/response shape

The brief's client interface is the normalization target:

```ts
resolveLink(url: string, signal: AbortSignal): Promise<{
  audioUrl: string;
  title: string;
  artist?: string;
  artworkUrl?: string;
  durationMs?: number;
}>;
```

### Proposed client contract (documented, not implemented)

If a compliant resolver ever exists, Krotify should call one endpoint and
normalize the result.

```http
POST {baseUrl}/v1/resolve
Accept: application/json
Content-Type: application/json
Authorization: Bearer <per-install token>   # only if the resolver requires it
Idempotency-Key: <uuid>

{
  "url": "https://example.com/track",
  "rightsGateVersion": 1,
  "client": { "name": "Krotify", "version": "0.2.1", "platform": "android" }
}
```

Success:

```json
{
  "status": "ok",
  "audioUrl": "https://resolver.example/file/abc",
  "expiresAt": "2026-11-14T12:00:00Z",
  "contentType": "audio/mp4",
  "sizeBytes": 3456789,
  "title": "Track title",
  "artist": "Artist",
  "artworkUrl": "https://resolver.example/art/abc.jpg",
  "durationMs": 214000
}
```

Error:

```json
{
  "status": "error",
  "code": "unsupported_link",
  "message": "Human-readable detail",
  "retryAfterMs": 30000
}
```

Rules:

- HTTPS only. No credentials in URLs.
- `audioUrl` must be a resolver tunnel or a short-lived signed URL. Do not return
  a raw platform media URL; those may expire or be bound to the resolver's IP or
  session.
- `expiresAt` is short, in minutes not days. The client downloads immediately and
  caches nothing remote.
- The client validates that `contentType` starts with `audio/`, enforces a maximum
  size and duration, checks free disk, writes to a temp file, then atomically
  moves it into app storage.
- The client supports cancel with `AbortSignal`; aborting the fetch aborts the
  body stream and deletes partial files.
- No playlist or channel expansion. One URL, one track.

### yt-dlp wrapper mapping (rejected)

A yt-dlp service would run something like
`yt-dlp -J --no-playlist -f bestaudio <url>` and map:

- `title` to `title`
- `uploader` or `channel` to `artist`
- `duration` to `durationMs` (`duration * 1000`)
- `thumbnail` to `artworkUrl`
- the selected `formats[].url` to `audioUrl`

Those fields are documented in the yt-dlp README's output-template section. The
service must then tunnel the bytes or download and re-serve them; returning the
raw `formats[].url` is unreliable. That is exactly the design cobalt exposes
(`tunnel`, `redirect`, `local-processing`), and exactly the part that requires
a server and ongoing maintenance.

### cobalt shape (reference only)

Cobalt's public docs show:

- `POST /` with `{ "url": "...", "downloadMode": "audio", "audioFormat": "mp3",
  "audioBitrate": "128" }`.
- Response `status` is one of `tunnel`, `local-processing`, `redirect`,
  `picker`, `error`.
- Tunnel or redirect response: `{ status, url, filename }`.
- Local-processing response includes `output` with `type`, `filename`,
  `metadata` (`title`, `artist`, `album`, and others), and `audio` with
  `format`, `bitrate` and `cover`.
- Auth: `Authorization: Api-Key <key>` or `Authorization: Bearer <jwt>`. A
  turnstile challenge can issue a short-lived Bearer token through `POST
  /session`.
- Rate limits: all endpoints except `GET /` are rate limited and return
  `RateLimit-*` headers.
- The hosted `api.cobalt.tools` instance is not for third-party use without
  permission.

This is a usable API shape, but not a usable permission.

## Auth, rate limits and cost

| Item | Self-hosted yt-dlp | cobalt | Licensed API | Ship disabled |
| --- | --- | --- | --- | --- |
| Auth | You add it; none by default | Api-Key or Bearer, optional | Vendor key plus quota | None |
| Rate limit | You set it; YouTube may block first | Configurable; `RateLimit-*` headers | Vendor-defined | None |
| Cost | Server, bandwidth, maintenance | Server, bandwidth, maintenance | Per call or plan | Zero |
| Secrets | Cookies or PO tokens on the server; never in the client | API key or JWT; client token in secure storage | API key; never in the client | None |
| Abuse control | You build it | turnstile, keys, limits | Vendor | Not applicable |

Client policy if ever enabled: one request per explicit user action, one
concurrent import, no background prefetch, no automatic retry beyond one on 5xx
or timeout, honor `Retry-After` and `RateLimit-*`, cap duration and size, cache
nothing.

## Failure states

| State | Detection | UI copy | Behavior |
| --- | --- | --- | --- |
| Unsupported link | 400 or `unsupported_link` | "That link is not supported. Paste a direct link to a track you can download." | Stop; no retry |
| Private or blocked | 403/404 or `blocked`/`private` | "This track is private, blocked or unavailable." | Stop; no retry |
| Resolver offline | network error, 5xx or timeout | "The resolver is offline. Try again later." | One retry, then stop |
| Rate limited | 429 | "Too many requests. Wait a moment and try again." | Honor `Retry-After`; no loop |
| Auth rejected | 401 | "The resolver rejected this app. Check the resolver settings." | Stop; no retry |
| Too large or long | 413 or contract limit | "This track is too large to import." | Stop |
| Disk full | write error or free-space check | "Not enough space to save this track. Free up space and try again." | Delete partial file |
| Cancelled | user abort | "Import cancelled." | Abort fetch; delete partial file |
| Bad response | invalid JSON or shape | "Something went wrong. Try again." | Stop; log the code only |
| Internal | 500 | "Something went wrong. Try again." | One retry, then stop |

A resolver failure must never touch the local library, the player queue or
existing imports. Existing local file import must continue to work identically.

## Rights gate

The gate has two parts:

1. A first-use explanation before any URL field is enabled.
2. A per-import attestation before the request. The action stays disabled until
   it is checked.

Exact future copy, not rendered while disabled:

- Title: "Before you import"
- Body: "Only import audio you own or have permission to download. You are
  responsible for the content you import."
- Checkbox: "I have the right to download this audio."
- Disclosure: "The link is sent to {resolver host} to fetch the audio."
- Action: "Resolve link"

The app does not verify rights. It records the gate version locally, sends
`rightsGateVersion` with the request, and logs only the result code on the
server. A server may reject requests without a current gate version. No bulk
import, no playlists, no channel URLs.

## Disabled UI copy

Place this in the Import tab as a non-interactive card below the file picker.
Do not render a URL field.

**Title:** Import from a link
**Badge:** Unavailable
**Body:** Krotify does not download from YouTube or other streaming services.
Those terms do not allow it.
**Help:** Link import needs a resolver that is licensed to download the source.
No licensed resolver is available, so this section stays off.
**Fallback:** Add music you own with Import audio files.

Accessibility label for the card: "Import from a link. Unavailable. Krotify does
not download from YouTube or other streaming services."

Settings must not show a resolver base URL field while disabled. When enabled in
the future, show the URL only, not a secret, and keep any token in secure storage
or on the server. Never commit a secret or hard-code an API key in the app
bundle.

## Feature flag shape (controller handoff)

Add this shape to `src/library/linkImport.ts` only when implementation resumes.
While disabled, the module is not created and `resolveLink` is not wired.

```ts
export const LINK_IMPORT_ENABLED = false as const;
export const LINK_IMPORT_RIGHTS_GATE_VERSION = 1 as const;

export type LinkImportConfig =
  | { enabled: false; reason: 'no-licensed-resolver' }
  | {
      enabled: true;
      resolverBaseUrl: string;
      rightsGateVersion: typeof LINK_IMPORT_RIGHTS_GATE_VERSION;
    };

export const LINK_IMPORT_CONFIG: LinkImportConfig = {
  enabled: false,
  reason: 'no-licensed-resolver',
};

export function isLinkImportAvailable(): boolean {
  return LINK_IMPORT_CONFIG.enabled && LINK_IMPORT_CONFIG.resolverBaseUrl.length > 0;
}
```

Controller rules:

- `LINK_IMPORT_ENABLED` stays `false`.
- The Import tab renders the disabled card above, not a URL input.
- Settings does not expose a resolver URL while disabled.
- No resolver client, dependency, secret, network call or scrape is added.
- Commit only this research memo for Task 11.

## Why this verdict

The technical shape is easy and already documented by yt-dlp and cobalt. The
permission is not. YouTube's consumer terms forbid downloading and automated
access without prior written permission. Its API policies separately forbid
downloading, offline playback, and separating audio tracks without prior written
approval. yt-dlp and cobalt are unlicensed for this use, and a commercial
converter cannot grant a license YouTube has not given. A user rights checkbox
addresses copyright ownership, not the platform contract, and does not authorize
circumvention.

The app is local-first and link import is optional. Shipping it disabled costs
nothing, keeps the store surface clean, and avoids building a server whose main
job is to be blocked or break. Re-open if the authorization changes, not because
the client code gets easier.

## What would change this verdict

1. YouTube's prior written permission, or a resolver vendor with documented
   authorization and indemnity for audio extraction.
2. A scope change to direct audio URLs the user hosts or that are explicitly
   licensed for download, with no platform extraction. That is a separate
   feature and a separate flag; it is not the YouTube link importer in the spec.
3. Legal sign-off for the target jurisdictions, including anti-circumvention and
   copyright.
4. Operational evidence: uptime, error rate, cost per import, abuse controls and
   a kill switch.
5. A real-device import and playback test plus a privacy review of the URL and
   metadata sent to the resolver.

## References

- YouTube Terms of Service, fetched 2026-11-14: https://www.youtube.com/t/terms
- YouTube API Services Developer Policies, last updated 2026-11-06:
  https://developers.google.com/youtube/terms/developer-policies
- YouTube developer policy guide, fetched 2026-11-14:
  https://developers.google.com/youtube/terms/developer-policies-guide
- yt-dlp README, fetched 2026-11-14: https://github.com/yt-dlp/yt-dlp
- cobalt API docs, fetched 2026-11-14:
  https://github.com/imputnet/cobalt/blob/main/docs/api.md
- cobalt instance docs, fetched 2026-11-14:
  https://github.com/imputnet/cobalt/blob/main/docs/run-an-instance.md
- cobalt README and license, fetched 2026-11-14:
  https://github.com/imputnet/cobalt
- Google Play Intellectual Property policy, fetched 2026-11-14:
  https://play.google/developer-content-policy/#intellectual-property
