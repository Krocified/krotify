# v4 Shuffle and Source-Scope Check

**Verdict:** source-scoped; no cross-source shuffle; no code in v4.
**Date:** 2026-11-14
**Evidence:**
- v3 shuffle contract:
  `docs/superpowers/plans/2026-11-13-v3-delight-and-ownership.md:124-144`
- v4 guardrail: `docs/superpowers/plans/2026-11-13-v4-discovery-exploration.md:136`
- Spec: `docs/spec.md:140-142`, `docs/spec.md:204-205`
- Current worktree: `feat/v4-research` branched from `main` at `8f4a3c5`.

## Current state

The v3 plan defines shuffle as a local-queue feature:

- `shuffleOrder(queue, keepIndex, random)` shuffles the remainder, keeps the
  current track first, and rebuilds the playlist window.
- `restoreOrder(original, currentId)` restores the original order at the
  current track.
- `PlayerProvider` gains `shuffle` and `toggleShuffle`, and keeps
  `originalQueue` while shuffled.
- Repeat one replays the current track; next/previous follow the shuffled order.
- The Now Playing screen gets a shuffle button next to repeat.

Important: this research worktree does **not** contain the v3 shuffle code.
`src/lib/shuffle.ts` is absent from `main` and `feat/v4-research`; the v3 module
exists on `feat/t2-shuffle-sleep` (commit `8040855`). v4 must consume the merged
v3 behaviour, not reimplement or fork it. Confirm the merge base before wiring
radio.

## Ruling

1. **Local shuffle semantics are unchanged by v4.** Enabling or disabling radio
   must not mutate the local queue, its order, its current index, its repeat
   mode, or its shuffle state.
2. **One shuffle control per source.** The local Now Playing shuffle affects
   only the local queue. If radio later gets a station list, its shuffle affects
   only that station list. There is no single control that shuffles local and
   radio together.
3. **No cross-source mixing.** A radio station never enters the local
   `AudioPlaylist`, never appears in local `hasNext`/`hasPrevious`, and never
   becomes the "next" track after a local song.
4. **Radio's first slice has no shuffle.** A live stream is one continuous
   source; shuffling it is meaningless. The radio slice is play/stop only. If a
   multi-station radio queue is added later, it gets its own shuffle, off by
   default.

## Repeat and next at the end of a radio source

- A live radio stream has no finite duration, so repeat one/all and "next" have
  no local-queue meaning.
- **Repeat:** hide or disable repeat controls while radio is the active source.
  Do not let local repeat state leak into radio.
- **Next at the end of a single station:** there is no "end"; if the stream
  drops, stop and show "Stream dropped — retry". Do not auto-advance to a local
  track.
- **If a station list is added later:** "next" advances to the next station in
  the radio result list, not to a local track. At the end of the list, stop by
  default; wrap only if the user explicitly enables loop for the radio station
  list.
- **Previous:** with a single station, restart is not meaningful for live audio;
  keep it disabled. With a station list, return to the previous station in that
  list.

## UI consequence

- The local Now Playing transport keeps the v3 shuffle and repeat controls.
- The Radio section has its own play/stop (and later next/previous for station
  lists only). It does not show the local shuffle control.
- Switching between local and radio does not reset the local shuffle order; when
  the user returns to local playback, the v3 `originalQueue`/current-track
  restore still applies.

## Why this rule

Cross-source shuffle would force two incompatible models into one queue: finite
local tracks with tags and a queue index, and infinite third-party streams with
no duration. That would break `hasNext`, repeat, the playlist window and the
notification controls, and it would mix an online source into a local-first
player. Source scoping is the smallest rule that keeps v3 semantics intact.
