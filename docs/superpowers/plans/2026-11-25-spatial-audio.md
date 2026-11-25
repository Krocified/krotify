# Spatial Audio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Android virtual-surround setting (`Off / Low / Medium / High`) backed by the OEM `Virtualizer` audio effect on the expo-audio playlist session.

**Architecture:** A pure JS module owns mode parsing, persistence and request mapping. The existing expo-audio patch gains a `Virtualizer` attached to the playlist's ExoPlayer audio session, exposes `setSpatialMode`, and reports `spatialEnabled` / `spatialSupported` in its status. `PlayerProvider` persists the mode, reapplies it through the engine, and falls back to Off only when support is definitively false. Settings → Playback renders the chips.

**Tech Stack:** React Native 0.88, Expo SDK 58, expo-audio 58.0.12 (patched via `patch-package`, built from source), `android.media.audiofx.Virtualizer`, node:test.

**Spec:** `docs/superpowers/specs/2026-11-25-spatial-audio-design.md`

## Global Constraints

- Android only; iOS/web get no UI and no-op engine calls.
- No new npm dependencies.
- `Virtualizer` is deprecated in API 35; keep it `@Suppress`ed and never let it crash playback.
- Per-session effects are expected to need no `MODIFY_AUDIO_SETTINGS`; confirm on device before release.
- Native changes go into `node_modules/expo-audio` and are persisted by regenerating `patches/expo-audio+58.0.12.patch`. expo-audio already builds from source via `expo.autolinking.buildFromSource`.
- The patch file also carries the lock-screen crash fix. Regenerating it must preserve that fix.
- Commit locally; never push.
- Strength presets: `off` 0, `low` 400, `medium` 700, `high` 1000.
- Storage key: `krotify.spatial.v1`.
- Settings placement only (Settings → Playback); no song-menu entry.

## Review Focus

- Unknown support (`null`) must not render "Not supported"; only a definitive `false` does.
- Enabling while paused or before an audio session exists must not crash, and must apply once playback starts.
- An unsupported device/emulator must stay Off, show the note, and keep playing.
- `engine.recreate()` / missing-file recovery must reapply the selected mode.
- Track changes, lock screen and notification controls must be unaffected.

---

### Task 0: Land the existing lock-screen crash fix

**Files:**
- Commit: `package.json`, `package-lock.json`, `patches/expo-audio+58.0.12.patch`

**Interfaces:**
- Consumes: already-applied crash fix.
- Produces: a clean base commit so spatial native changes diff separately.

- [ ] **Step 1: Confirm the crash fix files are the only staged changes**

Run: `git status --short`
Expected: `package.json`, `package-lock.json` modified; `patches/` untracked; no unrelated files.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json patches/expo-audio+58.0.12.patch
git commit -m "fix(player): patch expo-audio lock-screen crash"
```

- [ ] **Step 3: Verify**

Run: `git log -1 --oneline`
Expected: the commit above is `HEAD`.

---

### Task 1: Spatial mode helpers

**Files:**
- Create: `src/lib/spatial.ts`
- Test: `tests/spatial.test.ts`

**Interfaces:**
- Consumes: `@react-native-async-storage/async-storage` (same pattern as `src/library/scanPrefs.ts`).
- Produces:
  - `type SpatialMode = 'off' | 'low' | 'medium' | 'high'`
  - `const SPATIAL_MODES: readonly SpatialMode[]`
  - `const SPATIAL_KEY = 'krotify.spatial.v1'`
  - `type SpatialStorage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }`
  - `parseSpatialMode(raw: string | null | undefined): SpatialMode`
  - `serializeSpatialMode(mode: SpatialMode): string`
  - `loadSpatialMode(storage?: SpatialStorage): Promise<SpatialMode>`
  - `saveSpatialMode(mode: SpatialMode, storage?: SpatialStorage): Promise<void>`
  - `spatialStrength(mode: SpatialMode): number`
  - `spatialRequest(mode: SpatialMode): { enabled: boolean; strength: number }`
  - `spatialModeLabel(mode: SpatialMode): string`
  - `spatialNote(supported: boolean | null): string | null`
  - `shouldFallbackSpatial(mode: SpatialMode, supported: boolean | null): boolean`

- [ ] **Step 1: Write the failing test**

Create `tests/spatial.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SPATIAL_KEY,
  SPATIAL_MODES,
  loadSpatialMode,
  parseSpatialMode,
  saveSpatialMode,
  serializeSpatialMode,
  shouldFallbackSpatial,
  spatialModeLabel,
  spatialNote,
  spatialRequest,
  spatialStrength,
} from '../src/lib/spatial.ts';

test('parseSpatialMode defaults to off for unknown input', () => {
  assert.equal(parseSpatialMode(null), 'off');
  assert.equal(parseSpatialMode(undefined), 'off');
  assert.equal(parseSpatialMode(''), 'off');
  assert.equal(parseSpatialMode('surround'), 'off');
});

test('parseSpatialMode accepts every mode', () => {
  for (const mode of SPATIAL_MODES) assert.equal(parseSpatialMode(mode), mode);
});

test('serializeSpatialMode round-trips', () => {
  for (const mode of SPATIAL_MODES) {
    assert.equal(parseSpatialMode(serializeSpatialMode(mode)), mode);
  }
});

test('spatialStrength pins preset values', () => {
  assert.equal(spatialStrength('off'), 0);
  assert.equal(spatialStrength('low'), 400);
  assert.equal(spatialStrength('medium'), 700);
  assert.equal(spatialStrength('high'), 1000);
});

test('spatialRequest disables off and enables the rest', () => {
  assert.deepEqual(spatialRequest('off'), { enabled: false, strength: 0 });
  assert.deepEqual(spatialRequest('high'), { enabled: true, strength: 1000 });
});

test('spatialModeLabel is user-facing', () => {
  assert.deepEqual(SPATIAL_MODES.map(spatialModeLabel), ['Off', 'Low', 'Medium', 'High']);
});

test('spatialNote only warns on definitive unsupported', () => {
  assert.equal(spatialNote(null), null);
  assert.equal(spatialNote(true), null);
  assert.equal(spatialNote(false), 'Not supported on this device');
});

test('shouldFallbackSpatial only forces off when unsupported', () => {
  assert.equal(shouldFallbackSpatial('high', false), true);
  assert.equal(shouldFallbackSpatial('off', false), false);
  assert.equal(shouldFallbackSpatial('high', null), false);
  assert.equal(shouldFallbackSpatial('high', true), false);
});

test('loadSpatialMode reads and defaults', async () => {
  const store = {
    value: null as string | null,
    getItem: async () => store.value,
    setItem: async (_key: string, value: string) => {
      store.value = value;
    },
  };
  assert.equal(await loadSpatialMode(store), 'off');
  store.value = 'medium';
  assert.equal(await loadSpatialMode(store), 'medium');
});

test('saveSpatialMode writes the mode under the key', async () => {
  const calls: [string, string][] = [];
  const store = {
    getItem: async () => null,
    setItem: async (key: string, value: string) => {
      calls.push([key, value]);
    },
  };
  await saveSpatialMode('low', store);
  assert.deepEqual(calls, [[SPATIAL_KEY, 'low']]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/spatial.test.ts`
Expected: FAIL, cannot resolve `../src/lib/spatial.ts`.

- [ ] **Step 3: Implement `src/lib/spatial.ts`**

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SPATIAL_KEY = 'krotify.spatial.v1';
export const SPATIAL_MODES = ['off', 'low', 'medium', 'high'] as const;
export type SpatialMode = (typeof SPATIAL_MODES)[number];

const STRENGTH: Record<SpatialMode, number> = { off: 0, low: 400, medium: 700, high: 1000 };
const LABELS: Record<SpatialMode, string> = { off: 'Off', low: 'Low', medium: 'Medium', high: 'High' };

export type SpatialStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

export function parseSpatialMode(raw: string | null | undefined): SpatialMode {
  return SPATIAL_MODES.includes(raw as SpatialMode) ? (raw as SpatialMode) : 'off';
}

export function serializeSpatialMode(mode: SpatialMode): string {
  return mode;
}

export function spatialStrength(mode: SpatialMode): number {
  return STRENGTH[mode];
}

export function spatialRequest(mode: SpatialMode): { enabled: boolean; strength: number } {
  return { enabled: mode !== 'off', strength: spatialStrength(mode) };
}

export function spatialModeLabel(mode: SpatialMode): string {
  return LABELS[mode];
}

export function spatialNote(supported: boolean | null): string | null {
  return supported === false ? 'Not supported on this device' : null;
}

export function shouldFallbackSpatial(mode: SpatialMode, supported: boolean | null): boolean {
  return supported === false && mode !== 'off';
}

export async function loadSpatialMode(
  storage: SpatialStorage = AsyncStorage,
): Promise<SpatialMode> {
  try {
    return parseSpatialMode(await storage.getItem(SPATIAL_KEY));
  } catch {
    return 'off';
  }
}

export async function saveSpatialMode(
  mode: SpatialMode,
  storage: SpatialStorage = AsyncStorage,
): Promise<void> {
  await storage.setItem(SPATIAL_KEY, serializeSpatialMode(mode));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/spatial.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/spatial.ts tests/spatial.test.ts
git commit -m "feat(spatial): add spatial mode helpers"
```

---

### Task 2: Native Virtualizer and engine wiring

**Files:**
- Modify: `node_modules/expo-audio/android/src/main/java/expo/modules/audio/AudioPlaylist.kt`
- Modify: `node_modules/expo-audio/android/src/main/java/expo/modules/audio/AudioModule.kt`
- Modify: `src/player/audioEngine.ts`
- Regenerate: `patches/expo-audio+58.0.12.patch`

**Interfaces:**
- Consumes: `SpatialMode`, `spatialRequest` from Task 1.
- Produces:
  - Native playlist method `setSpatialMode(enabled: Boolean, strength: Int): Boolean`, returning `spatialSupported == true`.
  - Native status fields `spatialEnabled: boolean`, `spatialSupported: boolean | null`.
  - `PlaybackEngine.setSpatialMode(mode: SpatialMode): void`.

- [ ] **Step 1: Patch `AudioPlaylist.kt`**

Add imports:

```kotlin
import android.media.audiofx.Virtualizer
import androidx.media3.common.C
```

Add fields and a session listener above `init`:

```kotlin
@Suppress("DEPRECATION")
private var spatialVirtualizer: Virtualizer? = null
private var spatialEnabled = false
private var spatialStrength: Short = 0
private var spatialSupported: Boolean? = null
private var spatialSessionId = C.AUDIO_SESSION_ID_UNSET

private val spatialListener = object : Player.Listener {
  override fun onAudioSessionIdChanged(audioSessionId: Int) {
    applySpatial()
  }

  override fun onIsPlayingChanged(isPlaying: Boolean) {
    if (isPlaying) {
      applySpatial()
    }
  }
}
```

In `init`, after `installPlayerListeners()` add `ref.addListener(spatialListener)`.

Add methods:

```kotlin
@Suppress("DEPRECATION")
fun setSpatialMode(enabled: Boolean, strength: Int): Boolean {
  spatialEnabled = enabled
  spatialStrength = strength.coerceIn(0, 1000).toShort()
  applySpatial()
  sendStatusUpdate()
  return spatialSupported == true
}

@Suppress("DEPRECATION")
private fun applySpatial() {
  if (!spatialEnabled) {
    spatialVirtualizer?.enabled = false
    return
  }
  val sessionId = ref.audioSessionId
  if (sessionId == C.AUDIO_SESSION_ID_UNSET) {
    return
  }
  try {
    if (spatialVirtualizer == null || spatialSessionId != sessionId) {
      spatialVirtualizer?.release()
      spatialVirtualizer = Virtualizer(0, sessionId)
      spatialSessionId = sessionId
    }
    val effect = spatialVirtualizer ?: return
    if (effect.strengthSupported) {
      effect.setStrength(spatialStrength)
    }
    effect.enabled = true
    spatialSupported = effect.enabled
  } catch (error: Exception) {
    spatialVirtualizer?.release()
    spatialVirtualizer = null
    spatialSessionId = C.AUDIO_SESSION_ID_UNSET
    spatialSupported = false
  }
}
```

Add to `currentStatus()` map:

```kotlin
"spatialEnabled" to (spatialVirtualizer?.enabled == true),
"spatialSupported" to spatialSupported,
```

In `releasePlayer()`, before `super.releasePlayer()`:

```kotlin
ref.removeListener(spatialListener)
spatialVirtualizer?.release()
spatialVirtualizer = null
spatialSessionId = C.AUDIO_SESSION_ID_UNSET
```

- [ ] **Step 2: Patch `AudioModule.kt`**

Inside `Class(AudioPlaylist::class)`, next to `Function("clearLockScreenControls")`:

```kotlin
Function("setSpatialMode") { playlist: AudioPlaylist, enabled: Boolean, strength: Int ->
  runOnMain {
    playlist.setSpatialMode(enabled, strength)
  }
}
```

- [ ] **Step 3: Wire the engine in `src/player/audioEngine.ts`**

Add imports:

```ts
import { spatialRequest, type SpatialMode } from '../lib/spatial';
```

Extend the type and add a native shape:

```ts
type SpatialPlaylist = AudioPlaylist & {
  setSpatialMode(enabled: boolean, strength: number): boolean;
};

// in PlaybackEngine
setSpatialMode(mode: SpatialMode): void;
```

Inside `createEngine()`:

```ts
let spatialMode: SpatialMode = 'off';

const applySpatial = () => {
  if (Platform.OS !== 'android') return;
  const { enabled, strength } = spatialRequest(spatialMode);
  try {
    (playlist as unknown as SpatialPlaylist).setSpatialMode(enabled, strength);
  } catch {}
};
```

Call `applySpatial()` at the end of `recreate()` after the new playlist is configured, and at the end of `load()` after `playlist.play()` / `pause()`. Add the method:

```ts
setSpatialMode(mode) {
  spatialMode = mode;
  applySpatial();
},
```

- [ ] **Step 4: Regenerate and inspect the patch**

```bash
npx patch-package expo-audio
```

Expected: `patches/expo-audio+58.0.12.patch` updated; it still contains the `MetadataInjectingPlayer.kt` forwarding fix and now contains `AudioPlaylist.kt` / `AudioModule.kt` spatial changes.

- [ ] **Step 5: Verify the patch applies to a pristine package**

```bash
rm -rf /tmp/pa-spatial && mkdir -p /tmp/pa-spatial/node_modules
cd /tmp/pa-spatial && npm pack expo-audio@58.0.12 --silent >/dev/null
tar -xzf expo-audio-58.0.12.tgz && mv package node_modules/expo-audio
patch -p1 --dry-run < /home/maxjoong/Documents/personal/krotify/patches/expo-audio+58.0.12.patch
```

Expected: `checking file` lines for `AudioControlsService.kt`, `MetadataInjectingPlayer.kt`, the listener test, and both spatial files; no failures.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/player/audioEngine.ts patches/expo-audio+58.0.12.patch
git commit -m "feat(spatial): attach virtualizer to playlist"
```

---

### Task 3: Player state and Settings control

**Files:**
- Modify: `src/lib/features.ts`
- Modify: `src/player/PlayerProvider.tsx`
- Create: `src/components/SpatialAudioControls.tsx`
- Modify: `src/screens/SettingsScreen.tsx`

**Interfaces:**
- Consumes: Task 1 helpers, Task 2 `engine.setSpatialMode`.
- Produces:
  - `PlayerStatusValue.spatial: { mode: SpatialMode; supported: boolean | null }`
  - `PlayerActionsValue.setSpatialMode(mode: SpatialMode): void`
  - `SpatialAudioControls({ mode, supported, onSelect })`

- [ ] **Step 1: Add the feature flag**

In `src/lib/features.ts`:

```ts
export const SPATIAL_AUDIO_ENABLED = true;
```

- [ ] **Step 2: Wire `PlayerProvider.tsx`**

Add imports:

```ts
import {
  loadSpatialMode,
  saveSpatialMode,
  shouldFallbackSpatial,
  type SpatialMode,
} from '../lib/spatial';
```

Add the status/action types:

```ts
spatial: { mode: SpatialMode; supported: boolean | null };
// actions
setSpatialMode: (mode: SpatialMode) => void;
```

Inside the provider, after the `sleep` state:

```ts
const [spatialMode, setSpatialModeState] = useState<SpatialMode>('off');
const spatialSupported =
  (status as typeof status & { spatialSupported?: boolean | null }).spatialSupported ?? null;
```

Add the load effect:

```ts
useEffect(() => {
  let cancelled = false;
  void loadSpatialMode()
    .then((mode) => {
      if (cancelled) return;
      setSpatialModeState(mode);
      engine.setSpatialMode(mode);
    })
    .catch(() => {});
  return () => {
    cancelled = true;
  };
}, []);
```

Add the definitive-unsupported fallback effect:

```ts
useEffect(() => {
  if (!shouldFallbackSpatial(spatialMode, spatialSupported)) return;
  setSpatialModeState('off');
  engine.setSpatialMode('off');
  void saveSpatialMode('off').catch(() => {});
}, [spatialMode, spatialSupported]);
```

Add the action:

```ts
const setSpatialMode = useCallback((mode: SpatialMode) => {
  setSpatialModeState(mode);
  engine.setSpatialMode(mode);
  void saveSpatialMode(mode).catch(() => {});
}, []);
```

Include `spatial: { mode: spatialMode, supported: spatialSupported }` in `statusValue` (and both in its dependency array), and `setSpatialMode` in `actionsValue` (and its dependency array).

- [ ] **Step 3: Create `src/components/SpatialAudioControls.tsx`**

Props and rendering:

```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  SPATIAL_MODES,
  spatialModeLabel,
  type SpatialMode,
} from '../lib/spatial';
import { colors, radius, space, type } from '../theme';

type Props = {
  mode: SpatialMode;
  supported: boolean | null;
  onSelect: (mode: SpatialMode) => void;
};

export function SpatialAudioControls({ mode, supported, onSelect }: Props) {
  const disabled = supported === false;
  return (
    <View style={styles.chips}>
      {SPATIAL_MODES.map((option) => {
        const selected = option === mode;
        return (
          <Pressable
            key={option}
            onPress={() => onSelect(option)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={`Spatial audio ${spatialModeLabel(option)}`}
            accessibilityState={{ selected, disabled }}
            style={({ pressed }) => [
              styles.chip,
              selected && styles.chipSelected,
              disabled && styles.chipDisabled,
              pressed && !disabled && styles.chipPressed,
            ]}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
              {spatialModeLabel(option)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
```

Copy the chip styles from `src/components/SleepTimerControls.tsx` (`chips`, `chip`, `chipSelected`, `chipPressed`, `chipText`, `chipTextSelected`) and add `chipDisabled: { opacity: 0.4 }`.

- [ ] **Step 4: Add the row in `SettingsScreen.tsx`**

Imports:

```ts
import { SpatialAudioControls } from '../components/SpatialAudioControls';
import { SPATIAL_AUDIO_ENABLED } from '../lib/features';
import { spatialNote } from '../lib/spatial';
```

Read the new state:

```ts
const { sleep, spatial } = usePlayerStatus();
const { setSleep, setSpatialMode } = usePlayerActions();
```

Under the Playback section, after the Sleep timer `stackRow`:

```tsx
{SPATIAL_AUDIO_ENABLED && Platform.OS === 'android' ? (
  <View style={styles.stackRow}>
    <View style={ui.rowText}>
      <Text style={ui.rowTitle}>Spatial audio</Text>
      <Text style={ui.rowMeta}>
        {spatialNote(spatial.supported) ?? 'Virtual surround for headphones'}
      </Text>
    </View>
    <SpatialAudioControls
      mode={spatial.mode}
      supported={spatial.supported}
      onSelect={setSpatialMode}
    />
  </View>
) : null}
```

- [ ] **Step 5: Run tests, typecheck and lint**

```bash
npm test
npx tsc --noEmit
npx expo lint
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/features.ts src/player/PlayerProvider.tsx src/components/SpatialAudioControls.tsx src/screens/SettingsScreen.tsx
git commit -m "feat(settings): add spatial audio control"
```

---

### Task 4: Device checks and final verification

**Files:**
- Create: `docs/research/v9-device-checks.md`

**Interfaces:**
- Consumes: everything above.
- Produces: recorded evidence; no code interfaces.

- [ ] **Step 1: Create the device-check table**

Create `docs/research/v9-device-checks.md` with one row per check and empty Result/Notes columns:

```markdown
# v9 device checks

| Check | Steps | Expected | Result | Notes |
|---|---|---|---|---|
| Enable while playing | Settings → Playback → Spatial audio → High | Audible widening; Low/Medium/High differ | pending | |
| Enable while paused | Select High while paused, then play | Effect applies; no crash | pending | |
| Unsupported device | Emulator or device without the effect | Mode returns to Off; "Not supported on this device"; playback unaffected | pending | |
| Recreate | Play, trigger missing-file recovery or change queue | Mode stays selected and reapplies | pending | |
| Restart | Set High, kill and relaunch the app | High restored; applies on first play | pending | |
| Track changes | Let 10+ songs auto-advance | No crash; mode persists | pending | |
| Lock screen | Lock the screen, use notification controls | Playback and effect unchanged | pending | |
| Wired headphones | Enable High on wired output | Audible widening | pending | |
| Bluetooth | Enable High on Bluetooth output | Record whether effect applies or is bypassed | pending | |
| Phone speaker | Enable High on speaker | Record result | pending | |
```

- [ ] **Step 2: Run the full suite**

```bash
npm test
npx tsc --noEmit
npx expo lint
```

Expected: all pass.

- [ ] **Step 3: Build and run on device**

Run: `npx expo run:android` (or `eas build --profile development --platform android`)
Expected: app installs; execute every row in the table; replace `pending` with pass/fail and notes. If no device is attached, leave the rows `pending` and say so in the final report; do not claim a pass.

- [ ] **Step 4: Commit**

```bash
git add docs/research/v9-device-checks.md
git commit -m "docs(spatial): add device checks"
```
