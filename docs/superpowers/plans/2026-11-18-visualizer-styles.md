# Visualizer styles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mini-player bar visualizer with five low-opacity ambient styles (curved gradient lines, mirrored soundwave, flowing sheen, ambient blobs, sound thread), each track seeded to one style by its id.

**Architecture:** Pure style-selection and wave-path math live in `src/lib` (node-testable); a single `Visualizer` component dispatches on the picked style and renders one of five SVG-based sub-views driven by one shared Reanimated drift loop. The wide, pre-rendered gradient path translates horizontally inside a clipped container so the moving-gradient effect comes free from the drift.

**Tech Stack:** react-native-svg (via `expo install`), react-native-reanimated 4.7.1 (already present), node:test for pure logic.

**Spec:** docs/superpowers/specs/2026-11-18-visualizer-styles-design.md

## Global Constraints

- Install svg with `bunx expo install react-native-svg` (bun.lock present; resolves the SDK 58-compatible version). Never `bun add`.
- Do not create or edit `ios/`/`android/` directories.
- Colors come from the cover palette as `readonly [string, string]` (two colors), same as the old `WavyVisualizer` props.
- Default opacity 0.2 behind the pill content; pill content must stay readable.
- Reduce motion → static render, no loops started.
- Paused → drift continues at a slow speed (≈4× duration), never frozen mid-track.
- No comments in new code unless the task asks.

## Review Focus

- Track with a `track.id` that hashes to a given style always renders that same style (seeded pick is deterministic per id) — pinned by Task 2 test.
- `pickVisualizerStyle` never returns an index outside the five styles for arbitrary ids (empty string, unicode ids) — pinned by Task 2 test.
- Wave path builders return valid closed-form path strings (start with `M`, contain curve commands, finite numbers) for any width/period — pinned by Task 3 test.
- Reduce motion: no `Animated`/Reanimated loop starts; visual renders statically — covered by Task 4 code step (verify via lint/typecheck; behavior asserted by code structure, no runtime RN tests in this repo).
- Old `WavyVisualizer` fully removed: no imports remain — pinned by Task 5 grep step.

---

### Task 1: Install react-native-svg

**Files:**
- Modify: `package.json`, `bun.lock` (via expo install)

**Interfaces:**
- Produces: `react-native-svg` importable in `src/components/Visualizer.tsx` (Task 4).

- [ ] **Step 1: Install**

```bash
bunx expo install react-native-svg
```

- [ ] **Step 2: Verify resolution**

Run: `grep '"react-native-svg"' package.json`
Expected: a version line present.

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "build: add react-native-svg"
```

### Task 2: Style picker (`src/lib/visualizerStyle.ts`)

**Files:**
- Create: `src/lib/visualizerStyle.ts`
- Test: `tests/visualizerStyle.test.ts`

**Interfaces:**
- Consumes: `hashString` from `../src/lib/hash.ts`.
- Produces: `export const VISUALIZER_STYLES = ['curves', 'soundwave', 'sheen', 'blobs', 'thread'] as const;` and `export type VisualizerStyleName = (typeof VISUALIZER_STYLES)[number];` and `export function pickVisualizerStyle(seed: string): VisualizerStyleName;`

- [ ] **Step 1: Write the failing test**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickVisualizerStyle, VISUALIZER_STYLES } from '../src/lib/visualizerStyle.ts';

test('pick is deterministic per seed', () => {
  for (const seed of ['track-1', 'track-2', 'Some Song (Remastered).mp3', '']) {
    assert.equal(pickVisualizerStyle(seed), pickVisualizerStyle(seed));
  }
});

test('pick always returns a known style', () => {
  for (let i = 0; i < 200; i += 1) {
    const pick = pickVisualizerStyle(`seed-${i}`);
    assert.ok((VISUALIZER_STYLES as readonly string[]).includes(pick));
  }
});

test('different seeds can pick different styles', () => {
  const picks = new Set(
    Array.from({ length: 50 }, (_, i) => pickVisualizerStyle(`seed-${i}`)),
  );
  assert.ok(picks.size > 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test 2>&1 | grep -A2 visualizerStyle || npm test 2>&1 | grep -A2 visualizerStyle`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`pickVisualizerStyle(seed)` = `VISUALIZER_STYLES[hashString(seed) % VISUALIZER_STYLES.length]`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS, no failures.

- [ ] **Step 5: Commit**

```bash
git add src/lib/visualizerStyle.ts tests/visualizerStyle.test.ts
git commit -m "feat: seed visualizer style per track id"
```

### Task 3: Wave path geometry (`src/lib/waveGeometry.ts`)

**Files:**
- Create: `src/lib/waveGeometry.ts`
- Test: `tests/waveGeometry.test.ts`

**Interfaces:**
- Produces (used by Task 4's style components):
  - `export type WavePathInput = { width: number; height: number; periods: number; amplitude: number; phase: number };`
  - `export function sinePath(input: WavePathInput): string;` — smooth cubic-bezier sine of `periods` full cycles across `width`, centered vertically, capped at ±`amplitude` px, plus a closing baseline back to the start (fillable).
  - `export function mirroredPath(input: WavePathInput): string;` — symmetric audio-waveform envelope: same sine scaled so it bulges around the vertical center line, closed to the center line (fillable).
- Both return `d` strings starting with `M`, using only finite numbers.

- [ ] **Step 1: Write the failing test**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sinePath, mirroredPath } from '../src/lib/waveGeometry.ts';

const base = { width: 800, height: 64, periods: 3, amplitude: 10, phase: 0 };

test('paths start with M and use finite numbers', () => {
  for (const d of [sinePath(base), mirroredPath(base)]) {
    assert.ok(d.startsWith('M'));
    assert.ok(!d.includes('NaN'));
    assert.ok(!d.includes('Infinity'));
  }
});

test('paths scale with amplitude and periods', () => {
  assert.notEqual(sinePath(base), sinePath({ ...base, periods: 5 }));
  assert.notEqual(sinePath(base), sinePath({ ...base, amplitude: 20 }));
  assert.notEqual(mirroredPath(base), mirroredPath({ ...base, amplitude: 20 }));
});

test('paths shift with phase', () => {
  assert.notEqual(sinePath(base), sinePath({ ...base, phase: Math.PI / 2 }));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test 2>&1 | grep -A2 waveGeometry || true`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Sample the sine at ~8 points per period; connect points with cubic segments using the standard sine-approximation control offsets (`k ≈ 0.3642 × dx`). `mirroredPath` mirrors the sine to ±amplitude around `height / 2` and closes along the center line. Deterministic pure functions.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/waveGeometry.ts tests/waveGeometry.test.ts
git commit -m "feat: add wave path geometry helpers"
```

### Task 4: `Visualizer` component with five styles

**Files:**
- Create: `src/components/Visualizer.tsx`

**Interfaces:**
- Consumes: `pickVisualizerStyle` (Task 2), `sinePath`/`mirroredPath` (Task 3), `useReduceMotion` from `./useReduceMotion`, Reanimated (`useSharedValue`, `useAnimatedStyle`, `withRepeat`, `withTiming`, `cancelAnimation`), `LinearGradient`/`RadialGradient`/`Path`/`Rect` from `react-native-svg`.
- Produces: `export function Visualizer({ seed, colors, isPlaying, opacity = 0.2 }: { seed: string; colors: readonly [string, string]; isPlaying: boolean; opacity?: number }): ReactElement` — absolute-fill, `pointerEvents="none"`.

Implementation notes (the decisions the signature leaves open):
- One shared drift driver: a `useSharedValue(0)` + `withRepeat(withTiming(1, { duration }), -1)` loop; `useAnimatedStyle` maps it to `translateX: -periodWidth` so the loop is seamless (path/gradient built wide enough to repeat: content width = container + one extra period).
- `isPlaying` toggles duration between `~12000ms` (playing, per-style variance) and `~48000ms` (paused) by restarting the loop with `cancelAnimation` + fresh `withRepeat`, preserving the current value as the start.
- `reduceMotion` → render the static (untranslated) SVG, no loop.
- Style rendering, all stroked/filled with a horizontal `LinearGradient` of `colors[0] → colors[1] → colors[0]` baked into the wide art so drift moves gradient and shape together:
  - `curves`: 2–3 `sinePath` layers, different `periods`/`amplitude`/`phase`, strokeWidth 1.5–2.5, per-layer opacity ~0.5/0.35/0.25.
  - `soundwave`: one `mirroredPath` filled, plus a thinner stroked copy.
  - `sheen`: a wide `Rect` with the gradient (no path), one softer counter-drifting band.
  - `blobs`: 2–3 `Circle`s with `RadialGradient` fills (color → transparent), slow drift + gentle scaleY breathing.
  - `thread`: single 1.5px stroked `sinePath` with large `strokeDasharray` gaps; drift moves the dashes along the line.
- Svg `viewBox` uses `width + periodWidth × 2` headroom; the component sizes itself from `onLayout` of the parent (absolute fill).
- No comments; follow existing component style (see `src/components/AmbientBackdrop.tsx` for Reanimated patterns).

- [ ] **Step 1: Implement `Visualizer.tsx` per the notes above.**

- [ ] **Step 2: Verify**

Run: `bunx tsc --noEmit`
Expected: no errors.

Run: `bunx expo lint`
Expected: no errors in `src/components/Visualizer.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/Visualizer.tsx
git commit -m "feat: add five-style ambient visualizer"
```

### Task 5: Swap into MiniPlayer, remove old visualizer

**Files:**
- Modify: `src/components/MiniPlayer.tsx:19,137` (import + usage)
- Delete: `src/components/WavyVisualizer.tsx`

**Interfaces:**
- Consumes: `Visualizer` (Task 4). `isPlaying` already comes from `usePlayerStatus()` at MiniPlayer.tsx:27.

- [ ] **Step 1: Swap the usage**

Replace the `WavyVisualizer` import/usage with:

```tsx
<Visualizer
  key={visualizerKey}
  seed={track.id}
  colors={visualizerColors}
  isPlaying={isPlaying}
/>
```

Keep `key={visualizerKey}`, `visualizerColors`, and `visualizerKey` as-is (MiniPlayer.tsx:123-126).

- [ ] **Step 2: Delete the old component**

```bash
git rm src/components/WavyVisualizer.tsx
```

- [ ] **Step 3: Verify nothing references it**

Run: `grep -rn "WavyVisualizer" src/`
Expected: no matches.

Run: `bunx tsc --noEmit && bunx expo lint`
Expected: both clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/MiniPlayer.tsx
git commit -m "feat: rotate mini-player visualizer styles per track"
```

---

## Post-check

- [ ] Run `npm test`, `bunx tsc --noEmit`, `bunx expo lint` — all clean.
- [ ] Run `bunx expo-doctor` — dependency/config sanity after adding svg.
