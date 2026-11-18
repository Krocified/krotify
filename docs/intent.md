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

## Where it is now
v7 made the library feel like a collection: songs plus tags, collections for
Liked Songs, Playlists, Artists and Albums, local timed lyrics, real-art
backdrops, square covers, and background playback with notification controls.
v8 is not a new surface. It is the pass that makes the gestures I repeat every
day trustworthy: selecting many songs, importing a folder of albums, setting a
cover, trusting the notification remote, filling a playlist from inside it, and
a player that feels like a stage rather than a control panel.

## Goals
- Play my local audio files reliably, with background playback plus notification
  and lock-screen controls.
- Make the notification player a remote I can trust: artwork, title, transport
  and a seek bar with elapsed and remaining time that is there every time.
- Make album art the hero of every screen.
- Look and feel like a premium music app, not a file browser.
- Browse and search a real collection by album and artist, not by filenames.
- Keep playback contextual: what I open (album, artist, search, recent) becomes
  the queue, and repeat/history follow that context.
- Make bulk management first-class: select many songs, or many tags, and act
  once — hide, delete, tag, add to playlists — without the app rearranging
  itself around me.
- Make adding music feel immediate: the first track lands fast, the screen says
  what it is doing, and every file is copied once, not twice.
- Make adding music a first-class flow: pick local files, and pull audio from a
  YouTube link, without leaving the app. A link import either produces a playable
  file or a clear failure; a web page is never added as a track.
- Make every cover mine: choose artwork from the gallery or from files, and crop
  it to a square that matches what the frame shows — for tracks, playlists and
  artists.
- Build a playlist inside it: add songs from a search-and-tag picker in the
  playlist, without bouncing back to the library.
- Give artists a place: their own cover, their songs without album trivia, and a
  back that returns to Collections.
- Make the player a stage: two primary controls, everything else tucked away,
  lyrics that read like lyrics, and a backdrop that breathes the cover's colors.
- Keep lyrics local by default: import a `.lrc` file for a track and show timed
  lyrics. Explore LRCLIB as an optional lookup, never as a requirement.
- Explore beyond the library without losing it: internet radio and external
  metadata are opt-in extras, not a replacement for local playback.
- Be genuinely incremental: every milestone is shippable and useful on its own.

## Non-goals
- Streaming as the primary library or an online catalogue that replaces local
  files. Lyrics are local `.lrc` files by default. An optional LRCLIB lookup is
  an exploration, never a replacement or requirement. Optional radio/metadata
  exploration is a separate opt-in surface.
- Social features, accounts, recommendations, third-party lyric catalogues.
- Cross-platform polish (iOS/tablet) in v0 — Android first.
- Matching Spotify's catalogue or backend. This is a player, not a service.
- A bespoke in-app file browser. Adding music keeps using the system picker;
  speed comes from copying once and showing progress, not from rebuilding the
  picker.
- A custom notification or lock-screen layout beyond what the media session
  gives. The work is making the standard one correct, not replacing it.

## Anti-goals
- A settings-heavy power-user tool. Beauty first, knobs later.
- A file manager with a play button. If it looks like a list of files, it failed.
- A control surface that lies. A seek bar that appears only sometimes, or a crop
  that saves a different square than the one I framed, is broken — not
  "eventually consistent".

## Success
- I reach for Krotify instead of my current player day to day.
- The now-playing screen is something I'd screenshot.
- Adding the next milestone is a weekend, not a rewrite.
- The library reads as a collection of albums and artists, not a file listing.
- I can fix a wrong tag or cover without opening another app.
- I can select a dozen songs and hide, delete, tag or file them into a playlist
  in one pass, select all visible rows in one tap, and back cancels the selection
  instead of leaving the screen.
- I can fill a playlist from inside it, filtering by search or tag, and nothing
  already in it gets added twice.
- No text field I tap is ever hidden by the keyboard.
- I can import an album and watch it arrive, and each file is written once.
- I can import a `.lrc` from the song page and read it in time with the track.
- I can pick a cover from my gallery and crop a square that saves exactly what I
  framed.
- The notification shows the seek bar and timestamps every time I look, and
  scrubbing there moves the song.
- The player background drifts with the cover's palette without ever pulling my
  eye off the song, and back from an artist lands where I came from.
- The download stays lean: a phone build around 25MB, not a 76MB universal
  bundle of architectures I do not own.
- A downloaded track plays on the first try, and one bad file never stops the
  next one.

## Principles
- **Local-first**: the MP3s are the truth for playback; playback never needs the
  network. Lyrics are local `.lrc` files by default. An optional LRCLIB lookup is
  opt-in, cached, and never required.
- **Playable or absent**: a track exists in the library only if the app can play
  it. Link imports validate the bytes; a failed or HTML download is removed, not
  kept as a 0:00 row, and never wedges the player.
- **Edit in the app**: metadata edits change the library record, never the audio
  file.
- **Consent first**: nothing changes files without an explicit choice. Imports
  and deletes are deliberate; scanning is being made opt-in.
- **Truthful metadata**: tags come from the files; filenames are only a fallback
  and nothing is invented.
- **Art-first**: every track, playlist and artist has a beautiful cover, real or
  generated, and any chosen image can be cropped square.
- **One way back**: hardware back closes the innermost thing first — a sheet, a
  selection, a layer, a page — and never the page underneath it.
- **Say what you are doing**: anything longer than a moment shows progress and
  counts, and a long action can be stopped.
- **Show what you will save**: a crop, a cover and a queue preview show the
  result before it is committed.
- **Never under the keyboard**: if I can focus a field, the field and its submit
  action stay visible while I type.
- **Incremental**: v0 proves the loop; each version deepens one axis.
- **Lazy by design**: stdlib and Expo primitives before new dependencies.
- **Lean artifacts**: ship only the ABIs the target needs; no unused native
  payload in the release.
