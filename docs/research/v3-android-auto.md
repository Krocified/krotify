# v3 Android Auto / Media Browser Check

**Verdict: DROP for v3.** `expo-audio` exposes playback, lock-screen controls,
and a media session, but no media browser. Android Auto cannot browse the
library through it, and there is no small native add-on that preserves the
current playlist engine. Revisit only as a deliberate playback-backend
migration (for example to React Native Track Player v5), not as a stretch task.
**Date:** 2026-11-14
**Worktree:** `feat/stretch-research` from `feat/v3-v4` (`f385524`).
**Evidence:**
- `src/player/audioEngine.ts:61-109` — one `AudioPlaylist`, lock-screen metadata,
  windowed `load`/`append`.
- `src/player/PlayerProvider.tsx:119-148` — the engine loads only a
  `playlistWindow` slice plus a few appended tracks, not the full library.
- `node_modules/expo-audio/android/.../AudioControlsService.kt:42` —
  `MediaSessionService`, not `MediaLibraryService`.
- `node_modules/expo-audio/plugin/build/withAudio.js:75` — the service is
  declared `android:exported="false"` with only the
  `androidx.media3.session.MediaSessionService` action.
- Expo SDK 58 audio docs: https://docs.expo.dev/versions/v58.0.0/sdk/audio/
- Android Auto media overview:
  https://developer.android.com/training/cars/media
- Media browser manifest:
  https://developer.android.com/training/cars/media/configure-manifest
- Android Auto manifest:
  https://developer.android.com/training/cars/media/auto
- `MediaLibraryService`:
  https://developer.android.com/media/media3/session/serve-content
- Car testing: https://developer.android.com/training/cars/testing

## What `expo-audio` exposes

- `useAudioPlayer` / `useAudioPlaylist` and the imperative
  `createAudioPlayer` / `createAudioPlaylist`.
- `AudioPlaylist`: `add`, `insert`, `remove`, `skipTo`, `play`, `pause`, `next`,
  `previous`, `seekTo`, `loop`, `volume`, status events.
- `setAudioModeAsync({ shouldPlayInBackground, interruptionMode: 'doNotMix' })`.
- `setActiveForLockScreen(active, metadata, options)` and
  `updateLockScreenMetadata` for the notification, lock screen, and headset
  controls, with next/previous/seek options.
- On Android, the config plugin adds `AudioControlsService`, a foreground
  `MediaSessionService` with a media3 `MediaSession`, `exported="false"`, and
  the `androidx.media3.session.MediaSessionService` intent filter.
- Nothing for browsing: no library root, no children, no search, no media-item
  IDs, no Android Auto descriptor, no exported service.

## What Android Auto requires

1. An exported media browser service. Android Auto discovers it through
   `android.media.browse.MediaBrowserService` and/or
   `androidx.media3.session.MediaLibraryService`. It must be `exported="true"`.
2. A `MediaLibrarySession` (media3) or `MediaBrowserServiceCompat` with
   `onGetLibraryRoot`, `onGetChildren`, and optionally `onGetSearchResult`.
3. A content tree of `MediaItem`s: browsable containers (albums, artists,
   playlists, songs) and playable leaves, each with a stable media ID, title,
   and enough metadata for the car UI.
4. A `MediaSession` that answers transport commands and reports state.
5. The `com.google.android.gms.car.application` metadata pointing at
   `res/xml/automotive_app_desc.xml` containing `<uses name="media"/>`.
6. Startup without an Activity: the service must browse and play when the app
   process starts from the car, with no visible phone UI.
7. Voice/search and distraction requirements for a Play listing; testing with
   the Desktop Head Unit or real hardware. Sideloaded builds need Android Auto
   developer mode and "unknown sources".

## Gap matrix

| Requirement | `expo-audio` today | Gap |
| --- | --- | --- |
| Exported media browser service | Service exists but is `exported=false` | Must export and change service type |
| `MediaLibrarySession` browse callbacks | No | Must implement `onGetLibraryRoot`/`onGetChildren` |
| Library content tree | Engine holds a window only | Must expose the full library, not `windowRef` |
| Stable media IDs | Playlist entries are URIs; queue index is window-local | Must map media IDs to library tracks and global indexes |
| Play from car | No car event path | Must inject a queue and current index into JS/engine |
| Startup without Activity | Playback/session is driven by JS | Must browse and play headlessly |
| Manifest metadata | Absent | Config plugin or prebuild changes required |
| Voice/search | Absent | Additional work for Play quality guidelines |

Flipping `exported` and adding the descriptor is not enough. A
`MediaSessionService` has a session but no library, so Android Auto has nothing
to show in its browse UI. This is the decisive gap.

## Is a small native path possible?

Three candidates, all rejected for v3:

1. **Patch the `expo-audio` service in place.** Change `AudioControlsService`
   from `MediaSessionService` to `MediaLibraryService`, add browse callbacks,
   and feed it the library. This means forking a native module per Expo SDK,
   bridging SQLite/library data into the service, and mapping car selections
   back into the JS playlist window. Not small, and it breaks on every
   `expo-audio` upgrade.
2. **Add a sibling `MediaLibraryService` that wraps the existing session.**
   A new service could hold a `MediaLibrarySession` over a `MediaController`
   connected to `expo-audio`'s session, and publish a browse tree. But the
   controller cannot safely replace a JS-owned playlist: selecting a car item
   would desync `windowRef`, the global queue, repeat/shuffle, and the Now
   Playing UI. It also needs a native library snapshot and media-ID mapping.
   Brittle and not small.
3. **Replace the playback backend with React Native Track Player v5.** It
   advertises media3-based Android Auto/CarPlay with `setBrowseTree`, including
   cold-start browsing, and requires RN 0.76+ with the New Architecture. This
   is the only route that looks maintainable, but it is a backend migration:
   the playlist window, gapless loading, queue/global index mapping, lock
   screen, sleep fade, shuffle, favorites, and resume all move. It is not a
   native add-on and not a v3 stretch.

No option is both small and native while keeping `expo-audio`. That is the
ruling.

## Compatibility check against this engine

The existing playlist tests pass (117/117), including `tests/playlistWindow.test.ts`.
They confirm the current design is a bounded window: the engine loads a slice
around the current track and appends ahead, with `windowRef.globalIndexes`
translating local playlist positions to library positions. Android Auto expects
a stable tree over the whole library and can select any leaf at any time. The
engine has no API to accept an external "play media ID X in queue Y" command,
and it has no event bridge from a car browse selection. Even a perfect native
browse service would need this JS-side contract added and tested.

Also note the two services would compete for the same responsibility: the car
needs one service with both browsing and transport. Splitting them across an
expo-audio session and a second library session is the desync risk in option 2.

## Build / defer / drop

- **Build in v3:** no.
- **Drop:** the idea that Android Auto can be enabled by exporting the existing
  service or adding a small config plugin.
- **Defer:** Android Auto support to a dedicated backend project. Revisit only
  if car support becomes a product requirement.
- **Acceptance if revisited:** one exported `MediaLibraryService` (or RNTP
  equivalent) that owns browsing and transport; a full library tree built from
  the same source of truth as the phone UI; car-initiated play updates the phone
  queue, current track, repeat/shuffle, and Now Playing state; cold start with no
  Activity; DHU and real-car testing; no duplicate notification or session.
- **Do not** add native code, flip `exported`, or add an `automotive_app_desc`
  now. An exported service with no browse implementation is dead code and a
  review liability.

## Why this verdict

The current player is intentionally a windowed, JS-owned queue optimized for
gapless phone playback and lock-screen controls. Android Auto requires a
service-owned, browsable library and a car-initiated play path. Those are
different ownership models. The smallest honest change is a playback-backend
migration, which is far beyond a stretch research task. Dropping it now keeps
the v3 release focused and avoids a half-exported service that fails Android
Auto review and confuses future maintainers.
