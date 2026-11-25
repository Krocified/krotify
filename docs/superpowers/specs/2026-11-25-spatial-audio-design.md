# Spatial audio — design

## Intent

Give playback a spatial effect: a virtual-surround widening that makes stereo
music sound out of the head, controlled from Settings → Playback. Phones output
stereo; this is virtualisation, not real 5.1/Atmos. The effect is a global
playback setting, not a per-song one, so it does not belong in the song menu.

## Approach

**Primary: Android's OEM `Virtualizer` audio effect** on the player's own audio
session. On/off plus a strength preset. This is what most players call
"virtual surround"; quality depends on the device's audio HAL.

- No new dependency. `android.media.audiofx.Virtualizer` is in the platform.
- Deprecated in API 35 but still present and functional where the OEM
  implements it. Detection is explicit; unsupported devices are told so.
- Per-session effects do not need `MODIFY_AUDIO_SETTINGS`; verify once on
  device before shipping.

**Backup (not this round): a Media3 `AudioProcessor` DSP** attached to
ExoPlayer's audio sink (crossfeed + stereo widening). It works on every device
but is an out-of-head effect rather than surround, and needs real tuning. It is
a follow-up only: build it if the device checks below show `Virtualizer`
unsupported on the target phone. The JS API, persistence and UI below stay the
same, so the swap happens in the native layer only. This round ships the
`Virtualizer` path even if it ends up unsupported on one device; the check
decides whether to schedule the DSP follow-up.

## Where the code lives

The effect needs the playlist's ExoPlayer audio session id, which is private to
expo-audio. Extend the existing expo-audio patch rather than adding a module:

- Patched `AudioPlaylist.kt`
  - Owns one `Virtualizer` for the playlist's audio session.
  - `setSpatialMode(enabled, strength): Boolean` stores the desired state and
    applies it when a session exists; returns whether the effect is supported.
  - Re-applies when the audio session id appears/changes and when playback
    starts; releases the effect in `releasePlayer()`.
  - Adds `spatialEnabled` and `spatialSupported` (boolean or null) to
    `currentStatus()` so JS can show the truth, not the requested state.
  - Catches `IllegalArgumentException`, `IllegalStateException`,
    `UnsupportedOperationException` and `RuntimeException`; an unsupported
    device must never crash playback.
- Patched `AudioModule.kt`
  - `Function("setSpatialMode")` on `AudioPlaylist`, run on the main queue.
- Patch workflow: edit `node_modules/expo-audio`, regenerate
  `patches/expo-audio+58.0.12.patch`. This patch also carries the lock-screen
  crash fix, so both land together; expo-audio stays in
  `expo.autolinking.buildFromSource`.

## JS layers

- `src/lib/spatial.ts` (pure, tested)
  - `SpatialMode = 'off' | 'low' | 'medium' | 'high'`
  - `SPATIAL_MODES`, labels, strength mapping (`off` → disabled; 400 / 700 /
    1000).
  - `parseSpatialMode`, `serializeSpatialMode`, `loadSpatialMode`,
    `saveSpatialMode` on AsyncStorage key `krotify.spatial.v1`; default `off`.
- `src/player/audioEngine.ts`
  - `setSpatialMode(mode)`: no-op on web/iOS; stores the desired mode and calls
    the patched playlist method. Re-applies after `recreate()` and `load()`.
- `src/player/PlayerProvider.tsx`
  - Loads the persisted mode on mount, pushes it to the engine, and exposes
    `spatial: { mode, supported: boolean | null }` plus
    `setSpatialMode(mode)`.
  - Reads `spatialSupported` from the playlist status (narrow cast of the
    expo-audio status type) and surfaces it.
- `src/lib/features.ts`: `SPATIAL_AUDIO_ENABLED = true` for rollback.

## UI

Settings → Playback, below Sleep timer. A stack row like the sleep control:

- Title `Spatial audio`, meta `Virtual surround for headphones`.
- Chips: `Off · Low · Medium · High`; selected chip uses the accent fill.
- `Not supported on this device` replaces the meta when the playlist reports
  unsupported, and the selection falls back to Off.
- Hidden on iOS/web.
- No entry in the per-song actions sheet (global effect).

## Support state and failure handling

`spatialSupported` is tri-state:

- `null` / unknown: no session has been attempted yet. Row looks normal; no
  unsupported note. This avoids a false "Not supported" before first playback.
- `true`: `Virtualizer` attached to the session without throwing.
- `false`: construction/`setEnabled` failed, or no `EFFECT_TYPE_VIRTUALIZER`
  descriptor exists. Show `Not supported on this device`.

Support means the effect engine attached, not that the current output route
plays it. Bluetooth may bypass insert effects; that stays a device-check note,
not runtime route tracking, to keep the native patch small.

- Definitive unsupported → UI falls back to Off and persists Off; keep playing.
  Unknown → keep the selected mode and apply on the next session.
- Audio session not ready → keep the desired mode; apply when playback starts.
- If Android's system spatializer is also active, the two can stack. Test both
  on and off; if it sounds wrong, leave system spatializer alone (it is a
  system setting, not ours).

## Non-goals

- Mono/stereo channel switching.
- Real multichannel/Atmos.
- Per-track or per-playlist modes.
- EQ, bass boost, or a strength slider (presets only for now).
- iOS/web support.
- The DSP fallback (separate decision after device checks).

## Device checks

- Enable while playing: audible widening; Low/Medium/High differ.
- Enable while paused, then play: effect applies.
- Track changes, 10+ songs, lock screen, notification controls: unaffected.
- Missing-file recovery / `engine.recreate()`: mode survives and reapplies.
- App restart: mode restored from storage.
- Wired headphones, Bluetooth, phone speaker: record what works.
- Unsupported device or emulator: Off + honest note, no crash.

## Left to the builder

- Exact chip styling and whether the unsupported note lives in meta or a toast.
- `Virtualizer` priority and whether to try binaural vs transaural mode via
  `canVirtualize`/`forceVirtualizationMode`.
- Whether to probe support with `AudioEffect.queryEffects()` up front or learn
  it from the first apply.
- Patch layout inside `AudioPlaylist` and the exact status field names.
