# Queue List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Swipe up on Now Playing to see the remaining tracks in the current queue, in play order, and jump to any of them. Shuffle is hidden behind a flag.

**Architecture:** Queue stays per-origin (library A→Z by default, playlists/Liked/artists keep their own order). `PlayerProvider` exposes the upcoming slice and a `jumpTo(trackId)` action. A new `QueuePanel` animated sheet lives inside `NowPlayingScreen` and slides up on a vertical swipe.

**Tech Stack:** React Native 0.88, Expo SDK 58, `Animated` + `PanResponder` (matches `MiniPlayer`), node:test for pure logic.

**Spec:** `docs/superpowers/specs/2026-11-23-queue-list-design.md`

## Global Constraints

- Commit types must be patch-mapped (`fix`, `refactor`, `chore`, `test`, `docs`). Never `feat` or `!` until the user says minor bumps are allowed.
- Queue order is whatever collection playback started from; library default is `sortTracks` A→Z.
- Shuffle stays dormant behind `SHUFFLE_ENABLED = false`; do not delete shuffle logic or its tests.
- End-of-queue behavior is unchanged (repeat off stops, repeat all wraps).
- Queue panel is read-only: no reorder, no remove.
- Run `npm test`, `npx tsc --noEmit`, and `npx expo lint` before declaring done.

## Review Focus

- Current track is the last in the queue: swipe-up must show `Nothing up next`, not crash or show the current track.
- Queue of one track, or no queue (index `-1`): panel empty, row taps no-op.
- Tapping a row in mock/demo mode: must jump via the mock path, not the audio engine.
- Track auto-advances while the panel is open: the list must shrink from the top as playback moves.
- Lyrics mode / scrollable stage: swipe-up must not hijack the lyrics scroll; back closes the panel before the player.

---

### Task 1: Upcoming queue helper

**Files:**
- Modify: `src/lib/queue.ts`
- Test: `tests/queue.test.ts`

**Interfaces:**
- Produces: `upcomingQueue(queue: Track[], index: number): Track[]` — `queue.slice(index + 1)` when `index` is in range, else `[]`.

- [ ] **Step 1: Write the failing tests**

Add to `tests/queue.test.ts`:

```ts
import { upcomingQueue } from '../src/lib/queue.ts';

test('upcomingQueue returns the tracks after the current index', () => {
  const queue = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }] as Track[];
  assert.deepEqual(upcomingQueue(queue, 1).map((track) => track.id), ['c', 'd']);
  assert.deepEqual(upcomingQueue(queue, 0).map((track) => track.id), ['b', 'c', 'd']);
});

test('upcomingQueue is empty at the end and outside the queue', () => {
  const queue = [{ id: 'a' }, { id: 'b' }] as Track[];
  assert.deepEqual(upcomingQueue(queue, 1), []);
  assert.deepEqual(upcomingQueue(queue, -1), []);
  assert.deepEqual(upcomingQueue(queue, 5), []);
  assert.deepEqual(upcomingQueue([], 0), []);
});
```

Add `import type { Track } from '../src/types.ts';` at the top if not present.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `upcomingQueue` is not exported.

- [ ] **Step 3: Implement `upcomingQueue`**

Add to `src/lib/queue.ts`:

```ts
import type { Track } from '../types.ts';

export function upcomingQueue(queue: Track[], index: number): Track[] {
  if (index < 0 || index >= queue.length) return [];
  return queue.slice(index + 1);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/queue.ts tests/queue.test.ts
git commit -m "refactor(queue): add upcomingQueue helper"
```

---

### Task 2: Expose upcoming tracks and jumpTo from the player

**Files:**
- Modify: `src/player/PlayerProvider.tsx`

**Interfaces:**
- Consumes: `upcomingQueue(queue, index)` from Task 1.
- Produces: `PlayerStatusValue.upcoming: Track[]`; `PlayerActionsValue.jumpTo: (trackId: string) => void`.
- Later tasks rely on both names and signatures exactly.

- [ ] **Step 1: Add the type members**

In `PlayerStatusValue` add:

```ts
upcoming: Track[];
```

In `PlayerActionsValue` add:

```ts
jumpTo: (trackId: string) => void;
```

- [ ] **Step 2: Derive `upcoming`**

Import the helper:

```ts
import { isAtEnd, nextIndex, previousAction, upcomingQueue } from '../lib/queue';
```

After the `next`/`previous`/`skipNext`/`skipPrevious` callbacks (they must already exist), add:

```ts
const upcoming = useMemo(() => upcomingQueue(queue, index), [queue, index]);
```

- [ ] **Step 3: Add `jumpTo`**

After `navigate` is defined, add:

```ts
const jumpTo = useCallback(
  (trackId: string) => {
    const target = queueRef.current.findIndex((item) => item.id === trackId);
    if (target >= 0) navigate(target);
  },
  [navigate],
);
```

Include `upcoming` in `statusValue` (and its `useMemo` deps) and `jumpTo` in `actionsValue` (and its deps).

- [ ] **Step 4: Verify types**

Run: `npx tsc --noEmit`
Expected: PASS, no unused or missing members.

- [ ] **Step 5: Commit**

```bash
git add src/player/PlayerProvider.tsx
git commit -m "refactor(player): expose upcoming queue and jumpTo"
```

---

### Task 3: Disable shuffle behind a flag

**Files:**
- Modify: `src/lib/features.ts`
- Modify: `src/components/CollectionHero.tsx`
- Modify: `src/screens/NowPlayingScreen.tsx`
- Test: `tests/features.test.ts`

**Interfaces:**
- Produces: `SHUFFLE_ENABLED: boolean` exported from `src/lib/features.ts`.

- [ ] **Step 1: Write the failing test**

Add to `tests/features.test.ts`:

```ts
import { LINK_IMPORT_ENABLED, LYRICS_ENABLED, SHUFFLE_ENABLED } from '../src/lib/features.ts';

test('shuffle stays disabled for now', () => {
  assert.equal(SHUFFLE_ENABLED, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `SHUFFLE_ENABLED` is not exported.

- [ ] **Step 3: Add the flag**

`src/lib/features.ts`:

```ts
export const SHUFFLE_ENABLED = false;
```

- [ ] **Step 4: Hide shuffle controls**

In `src/components/CollectionHero.tsx`, import `SHUFFLE_ENABLED` from `../lib/features` and change the render conditions so the shuffle button only renders when `SHUFFLE_ENABLED && onShuffle`. Keep the group pill rendering when edit/add exist. Do not remove the `onShuffle` prop.

In `src/screens/NowPlayingScreen.tsx`, wrap the shuffle slot in the transport:

```tsx
{SHUFFLE_ENABLED ? (
  <View style={styles.shuffleSlot}>
    {/* existing shuffle Pressable unchanged */}
  </View>
) : null}
```

Import `SHUFFLE_ENABLED` from `../lib/features` alongside `LYRICS_ENABLED`. Keep the existing `shuffle`/`toggleShuffle` usage inside the flag branch.

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/features.ts tests/features.test.ts src/components/CollectionHero.tsx src/screens/NowPlayingScreen.tsx
git commit -m "fix(player): hide shuffle controls behind a flag"
```

---

### Task 4: QueuePanel component

**Files:**
- Create: `src/components/QueuePanel.tsx`

**Interfaces:**
- Consumes: `Track` from `../types`, `formatDuration` from `../lib/format`, theme tokens from `../theme`.
- Produces: `QueuePanel(props: { visible: boolean; upcoming: Track[]; onSelect: (track: Track) => void; onClose: () => void })`.

- [ ] **Step 1: Create the component**

Implement with these fixed behaviors:

- Slide-up sheet: `Animated.View`, `translateY` from window height to `0` over 220 ms on `visible`, back down on hide; `useNativeDriver: Platform.OS !== 'web'`. `pointerEvents` is `auto` only when visible.
- Layout: absolute, `top: '18%'`, `left/right/bottom: 0`, rounded top corners (`radius.screen`), background `colors.surface` (or `colors.bg`), z-index above player content.
- Header: grab handle bar, title `Up Next`, meta `` `${upcoming.length} ${upcoming.length === 1 ? 'song' : 'songs'}` ``, and a close button (`Ionicons` `chevron-down`) calling `onClose`.
- Swipe down: `PanResponder` on the header only. Claim when `Math.abs(dy) > 12` and vertical; on move set `translateY = Math.max(0, dy)`; on release `dy > 80` calls `onClose`, else springs back to `0`.
- List: `FlatList` of `upcoming`, `keyExtractor={(item) => item.id}`, content bottom padding includes `useSafeAreaInsets().bottom`.
- Row: `Pressable` with `CoverArt` (size 48), `MarqueeText` title, artist text when present, `formatDuration(item.durationMs)`, `accessibilityRole="button"`, `accessibilityLabel={`Play ${item.title}`}`, calls `onSelect(item)`.
- Empty state: centered `Nothing up next`.
- A dimmed backdrop `Pressable` above the player (not over the panel) that calls `onClose`.

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/QueuePanel.tsx
git commit -m "refactor(player): add queue panel component"
```

---

### Task 5: Wire swipe-up and row jumps into Now Playing

**Files:**
- Modify: `src/screens/NowPlayingScreen.tsx`

**Interfaces:**
- Consumes: `PlayerStatusValue.upcoming`, `PlayerActionsValue.jumpTo` (Task 2); `QueuePanel` (Task 4).

- [ ] **Step 1: Read player state and add panel state**

Destructure `upcoming` from `usePlayerStatus()` and `jumpTo` from `usePlayerActions()`. Add:

```ts
const [queueOpen, setQueueOpen] = useState(false);
```

- [ ] **Step 2: Add the swipe-up responder**

Create a `PanResponder` (mirroring `MiniPlayer`) that:

- claims moves when `gesture.dy < -16`, `Math.abs(gesture.dy) > Math.abs(gesture.dx)`, `!lyricsMode`, and `!queueOpen`;
- does not claim when `lyricsMode` is true;
- on release with `gesture.dy < -60` sets `queueOpen` true.

Attach `panHandlers` to the content `View` that wraps the top bar/stage/transport (the one with `styles.content`). Recreate the responder when `lyricsMode`/`queueOpen` change.

- [ ] **Step 3: Render the panel**

Render inside the root `Animated.View`, after the content `View`:

```tsx
<QueuePanel
  visible={queueOpen}
  upcoming={upcoming}
  onClose={() => setQueueOpen(false)}
  onSelect={(item) => {
    setQueueOpen(false);
    jumpTo(item.id);
  }}
/>
```

- [ ] **Step 4: Handle back**

Extend the existing back interceptor effect: when `queueOpen`, register a handler that sets `queueOpen` false and returns `true`; keep the existing `actionsOpen` behavior otherwise. Update the effect deps.

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 6: Manual verification**

Run `npx expo start`, open the web preview (`w`) or a device with a queue of at least three demo/library tracks and confirm:

1. Play the first track, swipe up: the list shows the remaining tracks in order.
2. Swipe down on the panel header / press back: returns to Now Playing.
3. Tap a row: playback jumps to that track, panel closes, up-next list shrinks.
4. Play the last track and swipe up: `Nothing up next`.
5. Enable lyrics mode, scroll lyrics: swipe-up does not open the queue panel.
6. Now Playing transport has no shuffle button; collection headers have no shuffle button.

- [ ] **Step 7: Commit**

```bash
git add src/screens/NowPlayingScreen.tsx
git commit -m "fix(player): open queue list on swipe up"
```

---

### Task 6: Full verification

- [ ] **Step 1: Run the full suite**

Run: `npm test && npx tsc --noEmit && npx expo lint`
Expected: all PASS.

- [ ] **Step 2: Review the diff**

Run: `git diff HEAD~4 --stat && git log --oneline -5`
Expected: only the files named in Tasks 1–5 changed; all commit subjects patch-mapped (no `feat:`).
