# krotify — Intent

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
- Play my local audio files reliably, with background playback and lock-screen controls.
- Make album art the hero of every screen.
- Look and feel like a premium music app, not a file browser.
- Be genuinely incremental: every milestone is shippable and useful on its own.

## Non-goals
- Streaming from a server or any online catalog.
- Social features, accounts, recommendations, lyrics licensing.
- Cross-platform polish (iOS/tablet) in v0 — Android first.
- Matching Spotify's catalogue or backend. This is a player, not a service.

## Anti-goals
- A settings-heavy power-user tool. Beauty first, knobs later.
- A file manager with a play button. If it looks like a list of files, it failed.

## Success
- I reach for krotify instead of my current player day to day.
- The now-playing screen is something I'd screenshot.
- Adding the next milestone is a weekend, not a rewrite.

## Principles
- **Local-first**: the MP3s are the truth; the app never needs the network.
- **Art-first**: every track/album has a beautiful cover, real or generated.
- **Incremental**: v0 proves the loop; each version deepens one axis.
- **Lazy by design**: stdlib and Expo primitives before new dependencies.
