# Queue list — design

## Intent

Give the player a visible queue. Swiping up on Now Playing reveals the tracks
still coming after the current one, in the order they will play. Shuffle is
disabled for now; the queue is always the order you started from.

## Decisions

- Queue stays per-origin. Library default is the whole library A→Z
  (`sortTracks`), same as today. Playlist, Liked, and artist plays keep their
  own order.
- New `QueuePanel` rendered inside `NowPlayingScreen`: slide-up panel over the
  player, swipe down or back to dismiss.
- Panel lists `queue.slice(index + 1)`: artwork, title, artist, duration.
  Header `Up Next · N songs`; empty state `Nothing up next`.
- Tapping a row jumps to that track (existing `navigate`/`goToGlobal`); earlier
  tracks are skipped, not removed, and do not appear in the list.
- End-of-queue behavior unchanged: repeat off stops, repeat all wraps.
- Shuffle: add `SHUFFLE_ENABLED = false` to `src/lib/features.ts` alongside the
  existing flags. Hide shuffle buttons in Now Playing and `CollectionHero`.
  Keep shuffle logic in `PlayerProvider` dormant so re-enabling is one flag.
- Expose the upcoming list from the player: add `upcoming: Track[]` to
  `PlayerStatusValue`, derived from `queue` and `index`. Works for mock and
  audio modes since both maintain `queue`/`index`.

## Gesture

- Swipe up on Now Playing opens the panel. Lyrics mode is a scrollable stage,
  so the panel only claims vertical gestures that are not already owned by a
  scrollable child.
- Inside the panel, swipe down (or back) closes it. Tapping a row jumps and
  closes.

## Non-goals

- Reordering or removing queue items.
- Played-history list above the current track.
- Queue persistence across app restarts.
- Queue access from the mini player.

## Left to the builder

- Exact PanResponder thresholds, animation timing/easing, and grab affordance.
- Row styling details and whether the panel shows a dimmed backdrop.
- Whether the current track is pinned above the list (spec says no) or only
  implied by the header count.
