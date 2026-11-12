# Krotify

A local-first Android music player for the songs you already own. No account, no
network, no catalogue. Album art is the product; the chrome stays quiet.

## Status

v0 and v1 are built, plus the v2 catalog: library scanning and filtering,
background playback, import/exclude/delete, ID3 metadata, Albums/Artists/Search,
Recently played, a draggable mini-player, a browser demo, and Settings.

Not built yet: playlist UI, favorites UI, notification next/previous, shuffle,
lyrics, and tag editing.

## Stack

Expo SDK 58, React Native 0.88, TypeScript, `expo-audio`, `expo-media-library`.

## Run it

```bash
./run.sh          # build and install on a connected Android device
./run.sh web      # browser demo at http://localhost:8081
```

The Android app needs a dev build (Expo Go cannot load the background-playback
config). Prerequisites: JDK 17, Android platform-tools (`adb`), USB or wireless
debugging enabled.

Web is demo-only: the demo library and mock player work; device scanning,
background audio and notification controls are Android-only.

## Check it

```bash
npm test          # pure logic, node --test
npx tsc --noEmit
npx expo lint
npx expo export --platform web
```

## Docs

- `docs/intent.md`: why this exists
- `docs/spec.md`: behaviour, design tokens, milestones
- `docs/superpowers/plans/`: the v0 implementation plan

## Layout

```
src/
  AppShell.tsx        screen state, library load, back handling
  player/             single expo-audio player plus a mock engine for demos
  library/            device scan and demo tracks
  screens/            Library, Now Playing, Settings
  components/         cover art, track row, mini-player, progress bar
  lib/                hashing, formatting, queue, mock clock (tested)
```
