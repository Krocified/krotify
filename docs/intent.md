# Krotify: Intent

## One line
A local-first, Spotify-feel Android music player for the songs you already own.

## Why build it
Existing local players (Auxio, Musicolet, Retro) work but feel utilitarian. The
value here is the *experience*: album art treated as the centerpiece, a dark
premium surface, motion that feels alive. Owning the app means the UI can be
exactly what I want, and it is a project that grows one layer at a time.

## Who it's for
Me. One user, my own MP3 library on my Android phone. No accounts, no sharing.

## Goals
- Play my local audio files reliably, with background playback plus notification and lock-screen controls.
- Make album art the hero of every screen.
- Look and feel like a premium music app, not a file browser.
- Browse and search a real collection by album and artist, not by filenames.
- Keep playback contextual: what I open (album, artist, search, recent) becomes
  the queue, and repeat/history follow that context.
- Make adding music a first-class flow: pick local files, and where permitted
  pull audio from a link, without leaving the app.
- Explore beyond the library without losing it: internet radio and external
  metadata are opt-in extras, not a replacement for local playback.
- Be genuinely incremental: every milestone is shippable and useful on its own.

## Non-goals
- Streaming as the primary library or an online catalogue that replaces local
  files. Lyrics lookup and optional radio/metadata exploration are separate,
  opt-in calls, never the default.
- Social features, accounts, recommendations, licensed lyric catalogues.
- Cross-platform polish (iOS/tablet) in v0 — Android first.
- Matching Spotify's catalogue or backend. This is a player, not a service.

## Anti-goals
- A settings-heavy power-user tool. Beauty first, knobs later.
- A file manager with a play button. If it looks like a list of files, it failed.

## Success
- I reach for Krotify instead of my current player day to day.
- The now-playing screen is something I'd screenshot.
- Adding the next milestone is a weekend, not a rewrite.
- The library reads as a collection of albums and artists, not a file listing.
- I can fix a wrong tag or cover without opening another app.
- The download stays lean: a phone build around 25MB, not a 76MB universal
  bundle of architectures I do not own.

## Principles
- **Local-first**: the MP3s are the truth; playback never needs the network.
  Lyrics lookup is the one optional exception, cached locally so it works
  offline after the first fetch.
- **Consent first**: nothing changes files without an explicit choice. Imports
  and deletes are deliberate; scanning is being made opt-in.
- **Truthful metadata**: tags come from the files; filenames are only a fallback
  and nothing is invented.
- **Art-first**: every track/album has a beautiful cover, real or generated.
- **Incremental**: v0 proves the loop; each version deepens one axis.
- **Lazy by design**: stdlib and Expo primitives before new dependencies.
- **Lean artifacts**: ship only the ABIs the target needs; no unused native
  payload in the release.
