# Visualizer styles — design

## Intent

Replace the 12-bar `WavyVisualizer` behind the mini-player content with a set of
ambient, low-opacity visual styles. Each track randomly gets one style, giving
every song its own personality while keeping the sleek, calm feel the spec calls
for (docs/spec.md:814: "a low-opacity line visualizer in the cover palette
animates behind the content").

## Styles

1. **Curved gradient lines** — 2–3 thin overlapping wave curves drifting at
   different speeds/opacities, gradient-stroked in the cover palette.
2. **Mirrored soundwave** — a center-symmetric waveform envelope with the same
   gradient treatment.
3. **Flowing sheen** — a soft cover-palette gradient band drifting sideways,
   no waveform motion.
4. **Ambient blobs** — 2–3 large, very soft radial-gradient blobs drifting;
   soft edges via layered radial gradients (no Skia blur).
5. **Sound thread** — one thin gradient line with a traveling dash/gap
   sliding along it.

## Selection

Seeded by `track.id` (stable hash → style index): the same track always gets
the same style; the queue shuffles styles naturally. Pure random per mount was
rejected — the pill can remount and would re-roll the same track's look.

## Tech

- `react-native-svg`, installed via `expo install` (bundled in Expo Go, SDK 58-safe).
- Existing Reanimated (4.7.1) drives horizontal drift of wide pre-rendered
  gradient paths with native transforms — the moving-gradient effect comes free
  from translating a static gradient baked into the wide path.
- No Skia.

## Behavior

- Faster/livelier while playing; slows to a near-still drift when paused.
- Honors the existing `useReduceMotion` setting: static gradient, no motion.

## Non-goals

- Real FFT audio reactivity (Android-only via RECORD_AUDIO permission; iOS has
  no equivalent).
- Style switching mid-track.
- Full-screen visualizer.

## Left to the builder

- Exact path geometry, periods, and drift speeds per style.
- Opacity ramp (default ~0.2, tuned per style so the pill stays readable).
- Hash implementation for the seed.
