# Krotify v5: File ownership and library truth

## Intent

v5 changes what the app treats as truth. Today the audio file is the truth: the app
reads ID3 tags, rewrites them in place, and renames the file when the user edits a
track. That model is fragile on Android scoped storage, and it is the source of the
v4 failures: edits and renames fail, and one playable MP3 is rejected at import.

In v5 the file is immutable. Krotify owns a library record in SQLite, and the record
carries the name, artist, album, artwork and tags the user sees. The file is stored
once in a folder the user chooses and is never renamed or re-tagged by the app.
Editing a track changes the app's view, not the file.

This also gives the app a place to record state it has never had: whether a file is
missing, whether a track was hidden or removed, which tags a track carries, and where
its artwork comes from.

## Why now

The v4 core experience made the everyday player trustworthy except at the file
boundary. Three of the reported bugs are the same boundary:

1. Editing metadata or renaming fails.
2. A perfectly playable MP3 is rejected as "copy failed".
3. A missing file wedges playback for every later track.

Rewriting tags is the expensive, permission-sensitive operation. Removing it deletes
the failure mode instead of repairing it, and moves the product toward a real library
record that can survive rescans, moved files and missing files.

## Goals

- The DB is the source of truth for display name, artist, album, artwork, tags and
  per-track app state.
- Imported and downloaded audio is stored once in a user-chosen folder, visible in
  the system file manager, and never renamed or edited by the app afterwards.
- A missing file is detected before playback, shown as a warning with a delete/purge
  call to action, and does not block playing anything else.
- Editing a track always works: it is a DB write, with no write-access prompt, no
  snapshot/restore and no copy fallback.
- Hidden tracks move to their own Settings page, with explicit Clear and Delete.
- App-local tags: create, assign, unassign, and filter the library by one tag.
- YouTube link import through the ytmp3.ge API, downloaded into the chosen folder.
- Settings presents scan, rescan, permission, exclude and storage as real,
  functioning controls.
- Lyrics UI is hidden for now.
- Recently played is smaller, and the recent imports list is gone.

## Non-goals

- Editing tags in the file, for any source.
- Reading tags on every launch. Tags seed the DB once; after that the DB wins.
- Syncing metadata to other players or to the system MediaStore.
- A tag manager beyond create, assign, unassign and filter.
- Link imports other than the ytmp3.ge API.
- iOS. The folder picker and downloads ship Android-first; the web preview stays a
  demo surface.

## Anti-goals

- A file manager. The user should never see a raw path unless they ask for details.
- Silent data loss. Clear never deletes a file; Delete always confirms and names the
  track first.
- Blocking the library on a slow or unreachable storage provider.
- Reintroducing in-place writes "just for imported files" because it looks simpler.

## Constraints

- Expo SDK 58, React Native 0.88, TypeScript, `expo-sqlite`, `expo-file-system`
  (`Directory.pickDirectoryAsync`, `File.downloadFileAsync`), `expo-document-picker`,
  `@missingcore/react-native-metadata-retriever`, `expo-audio` (`AudioPlaylist`).
- No new runtime dependency unless `npx expo install` resolves an SDK-compatible
  version.
- Local playback works with no network and no account.
- Android first; a development build is required for audio, MediaStore and the SAF
  folder.
- No comments unless they explain a non-obvious decision. Conventional Commits. No
  push without an explicit instruction.

## Approaches considered: where audio lives

### A. Reference files in place

The picker returns a content URI; the app takes persistent read permission and plays
the original. No copies, zero duplicate storage, literally "in place".

Rejected. `expo-document-picker` does not request persistable URI permission, so this
needs a new native module. Permission loss or a provider change silently breaks the
library, delete would remove the user's original file, and metadata reads would hit a
provider on every cold start. Too much fragility for the one guarantee v5 is trying
to create.

### B. One chosen Krotify folder (chosen)

Each import and download is copied once into a folder the user picks in Settings.
Default is app-private storage, changeable through the system folder picker. The app
stores the resulting `file://` or SAF URI plus a display name in the DB. Files are
never renamed or edited after the copy. Changing the folder offers to move the
app-owned files once.

Trade-off: duplicate storage at import time, and a copied file is not the original.
That is the point: Krotify owns a stable copy it can play, delete and survive a
rescan with. It is also the only model where "storage location" in Settings is real.

### C. Keep app-private imports

Today's behavior. Rejected: it makes the storage setting half-real and keeps imports
invisible in the file manager.

## Decisions

- **File model:** immutable. No in-place tag writes, no file renames, no copy-to-edit
  fallback. The local Kotlin `audio-tags` module and the TS tag-writer orchestration
  are deleted.
- **Metadata:** read once when a track enters the library (import, download, first
  scan) and stored in SQLite. User edits update SQLite only. When a file has no tags,
  the filename-derived title is stored.
- **Artwork:** a single `artworkUri` per track. It accepts a local `file://` path or
  an `http(s)` URL. Embedded artwork is extracted once into the app artwork folder;
  a picked image or the ytmp3.ge thumbnail is copied there. Remote URLs are allowed
  but local wins.
- **Storage location:** Settings, Storage section. Default app-private
  `Paths.document/Krotify` on a fresh install and the existing
  `Paths.document/imports` on a migrated install. Change opens
  `Directory.pickDirectoryAsync()`. Existing app-owned files can be moved after a
  confirmation. Scan tracks are never moved. Files are stored flat in the root, with
  ` (2)`, ` (3)` added on a name collision; the move action flattens legacy
  per-import subfolders.
- **IDs:** keep existing IDs exactly. Scan tracks keep the bare MediaStore asset id
  (no new prefix), because every existing foreign key and the resume key already use
  it. Migrated imports keep `import:<hash(name:size)>`; files created in v5 use a new
  stable `own:<uuid>`. Rewriting legacy scan ids would force a rewrite of favorites,
  playlists, history, lyrics and resume for no gain.
- **MediaStore identity limit:** the asset id is the identity. If Android reissues an
  id after a move or a delete-and-restore, the file appears as a new track. The app
  does not match scan tracks by path or name plus size; that would create merge
  conflicts. "A missing track returns" means the same asset id returns.
- **Track status:** `active | hidden | removed`. `hidden` is the old "excluded" and is
  listed in the Hidden tracks page. `removed` is the "clear" outcome: gone from the
  app, file untouched, and kept as a tombstone so a rescan cannot re-add it. This is
  true for every source.
- **Clear vs Delete:** Clear sets `status = 'removed'` and keeps both the row and the
  file, for scanned and owned tracks alike. That is what makes reclaimable space
  computable and makes a rescan idempotent. Re-importing a file whose name and size
  match a removed owned row reactivates that row instead of creating a duplicate.
  Delete removes the DB row and the file, after a confirmation that names the track.
- **Missing files:** detected before load and on scan. A missing track stays in the
  DB with `missing = 1`, is shown with a warning and a Delete CTA, and is skipped by
  playback. Missing scan tracks return if the file reappears.
- **Tags:** app-local, many-to-many. A tag filter bar sits above Recently played and
  is hidden entirely when no active track has a tag. Single-select: All plus the tags
  that have at least one active track. Tags are created in the track editor; the bar
  has no add control, because a new tag with no tracks would be hidden immediately.
- **Player recovery:** every load path validates the file first, builds the window
  only from playable entries, and clears the engine on failure. A failed file sets an
  error and must never prevent the next play.
- **ytmp3.ge:** link import posts to `https://ytmp3.ge/api/convert`, downloads the
  returned `downloadUrl` into the chosen folder, stores the returned title, and copies
  the thumbnail as artwork. No other resolver.
- **Lyrics:** code stays, UI is hidden behind a constant.
- **Recently played:** cards shrink from 120px to 72px, and the rail caps at 8 tracks.
- **Import tab:** no recent imports list. After a successful local import or link
  download the app switches to Library and reports the result. The tab keeps the
  import and link cards, progress and per-file failures.
- **Architecture:** this is a data and file-ownership rewrite, not a folder reshuffle.
  New modules live in `src/tracks`, `src/imports` and `src/tags`; existing screens are
  adapted rather than moved wholesale.
- **Settings:** Library (permission with Grant, scan toggle, rescan with progress and
  last result, hidden page row, exclude all with a count), Storage (current folder,
  change, move existing), Playback (sleep timer), About. The Lyrics and Editing
  sections are removed.

## Data model (schema v4)

```ts
type TrackRecord = {
  id: string;
  source: 'scan' | 'import' | 'download';
  location: string;        // file://, content:// or SAF URI
  fileName: string;
  sizeBytes?: number;
  durationMs: number;
  title: string;
  artist: string;
  album: string;
  albumArtist?: string;
  trackNumber?: number;
  discNumber?: number;
  year?: number;
  genre?: string;
  explicit?: boolean;
  artworkUri?: string;
  status: 'active' | 'hidden' | 'removed';
  missing: 0 | 1;
  addedAt: number;
  lastSeenAt: number;
  artworkHue: number;
};
```

Tables:

- `tracks` — the columns above. `location` is indexed; `status` is indexed.
- `tags (id TEXT PK, name TEXT NOT NULL UNIQUE COLLATE NOCASE, createdAt INTEGER)`
- `track_tags (trackId TEXT, tagId TEXT, PRIMARY KEY(trackId, tagId))` with both
  foreign keys cascading.
- `settings (key TEXT PK, value TEXT)` for the storage folder URI/name and last scan
  summary. Scan enabled and lyrics preference may stay in AsyncStorage.
- Kept unchanged: `playlists`, `playlist_tracks`, `favorites`, `play_history`,
  `lyrics_cache`.
- Removed: `track_metadata` (folded into `tracks`) and the AsyncStorage import and
  exclusion lists (migrated, then ignored).

Migration v3 → v4, in this order (imports first, so their cached metadata can be
folded in rather than becoming phantom scan rows):

1. Create `tracks`, `tags`, `track_tags`, `settings`.
2. Read `krotify.imports.v1`, insert each as `source = 'import'`, `status = 'active'`,
   `location` from the stored URI, title/artist from the stored record, and
   `missing = 0` when the file exists.
3. Read every `track_metadata` row. If its id matches an import row, fold its fields
   into that row (artwork, genre, numbers, explicit). Otherwise insert a scan seed row
   with `source = 'scan'`, `location = ''`, `status = 'active'`, `missing = 1`. A scan
   seed is not shown in the library until a scan resolves it.
4. Read `krotify.excluded.v1`, find or insert each by id, set `status = 'hidden'`.
5. Leave the old AsyncStorage keys in place for one release, read-only, in case of
   rollback. Stop writing them. Keep the `track_metadata` table unused for one
   release before dropping it.
6. Imported files already in app storage stay where they are. On a migrated install
   the storage root defaults to the existing `Paths.document/imports` directory, so no
   file moves are needed. A fresh install defaults to `Paths.document/Krotify`.
   Settings presents both as "App storage" and offers "Move to Krotify folder" once.

Scan gating: when scanning is off or permission is denied, `loadTracks()` returns
owned rows (import/download) plus scan rows that were resolved by a previous scan. It
does not show unresolved migration seeds or mark them missing. Their records survive
untouched until a scan resolves or hides them.

## Feature designs

### Library load and scan

`loadTracks()` reads active records from SQLite. `scanLibrary()` pages MediaStore,
upserts by `scan:<assetId>`, and returns:
- new tracks inserted as active, with tags read once and seeded;
- existing tracks refreshed (`lastSeenAt`, `missing = 0`) and their overrides kept;
- rows absent from MediaStore marked `missing = 1`, never deleted;
- `removed` rows skipped entirely and never re-inserted;
- `hidden` rows kept hidden.

Owned-folder exclusion: if the storage root is inside a scanned volume (the user
picked a public music or download folder), the scan skips every asset whose resolved
path is under that root, so an owned copy never also becomes a scan track. For SAF
roots whose filesystem path cannot be resolved, fall back to skipping assets whose
file name and byte size match an active or removed owned row. A dev-build spike
confirms which rule works for the folders actually picked.

The merge is by stable id, so favorites, playlists and tags survive a rescan. The
first scan after migration is the expensive one; later scans only upsert changes.
Chunk inserts in transactions.

A scan result is recorded in `settings` (`lastScanAt`, `found`, `new`, `missing`) so
Settings can show something true.

### Imports

`pickAndImportTracks()`:
1. `DocumentPicker.getDocumentAsync({ type: 'audio/*', multiple: true,
   copyToCacheDirectory: true })`.
2. For each asset, sanitize the name, resolve the extension from the MIME type, and
   copy into the chosen folder. On a name collision, append ` (2)`, ` (3)`.
3. Validate the destination exists and is larger than zero. Do **not** compare the
   copy size to the provider-reported size. Probe duration; if the probe times out but
   the file is non-zero, keep the track with `durationMs = 0` and let the player read
   the real duration. This is the fix for the false "copy failed".
4. Dedupe by name plus size plus folder; a duplicate is reported as skipped, not a
   failure.
5. Read tags once, extract embedded artwork, insert the DB row, return
   `{ added, skipped, failures }`.
6. The Import screen shows per-file failures and the first reason. On success, the
   shell switches to Library and shows a short toast.

`importTrackCopy` disappears with in-place editing.

### ytmp3.ge link import

`convertLink(url, quality)`:
1. Validate the URL client-side: `youtube.com/watch?v=` or `youtu.be/`, no playlists.
2. `POST https://ytmp3.ge/api/convert` with
   `Content-Type: application/x-www-form-urlencoded`, body
   `youtube_url=<url>&quality=<128|192|256|320>`. Default 192.
3. Parse `{ success, videoId, title, thumbnail, duration, size, downloadUrl, error }`.
   A `success: false` response becomes a readable error.
4. Download `downloadUrl` into the chosen folder with a safe filename from the title.
   If downloading straight to a SAF destination is unsupported, download to cache then
   stream/copy to the folder.
5. Download the thumbnail into the artwork folder. Store it as `artworkUri`.
6. Insert a `source = 'download'` row with the returned title and duration (fall back
   to probing the file).
7. The UI shows a progress state, supports cancel, and reports failures without
   touching the library.

The network layer lives in one module with a pure response parser so it is testable
offline.

### Playback and missing files

- Resolve a playable URI for every window entry. For scans, use the resolved MediaStore
  URI and confirm the asset still exists. For owned files, `new File(uri).exists`.
- Drop dead entries before `engine.load`. If the target is dead, set `lastError` to
  "File missing", mark the record `missing = 1`, and do not load a broken playlist.
- Any load or playlist error calls `engine.stop()` and clears the window, so the next
  play starts clean. This is the fix for "playing anything else won't start".
- Offer to advance to the next playable track when the current one is missing.
- The now-playing screen and the track action sheet show a missing-file warning with
  "Delete from library" (clear) and "Delete file" (delete).

### Tags

- Track editor gets a Tags section: chips for assigned tags, a field to create a new
  tag, and tap-to-unassign.
- `TagProvider` loads tags and counts once per library change.
- `TagFilterBar` above Recently played: horizontal chips, All first, then tags with at
  least one active track. Hidden when no tags exist. Selecting one filters the track
  list; the selected chip is cleared when its tag disappears.
- `track_tags` cascades on track delete. Tags with no tracks are hidden from the bar,
  not deleted.
- Editing a track's tags is a DB write and always succeeds offline.

### Hidden tracks page

A Settings row ("Hidden tracks, N") opens its own full-screen page with the same back
behavior as Settings. It lists hidden records with artwork, title and artist, plus:
- **Restore** per row and Restore all.
- **Clear** per row: confirm, then set `status = 'removed'` and keep both the row and
  the file, for every source. The row is the tombstone that stops a rescan, and for an
  owned file it is what makes the file count as reclaimable space.
- **Delete** per row: confirm with the title, then remove the DB row and the file.
- Empty state when nothing is hidden.

The page also surfaces missing-file warnings. Cleared owned files are reported in
Settings under Storage, where Clean removes their orphaned files and tombstones.

### Settings revamp

- **Library:** permission row with state (Granted / Not granted / Not asked) and a
  Grant action that re-requests or opens app settings; scan toggle; Rescan showing a
  spinner, then "N tracks, M new, K missing" and the last scan time; Hidden tracks
  row with count; Exclude all scanned with the exact count, disabled at zero with a
  reason.
- **Storage:** current folder display name; Change folder; Move existing files with
  count and size; reclaimable space from cleared owned files with a Clean action.
- **Playback:** sleep timer.
- **About:** version, ABI.
- Lyrics and Editing sections are gone.

### Library and Import surfaces

- Library: tag filter bar above Recently played; Recently played at 72px and 8 items;
  missing-file rows marked; everything else unchanged.
- Import: local import card, link import card with URL field, quality selector and
  progress, per-file failures as today, no recent imports list. After success,
  navigate to Library.

### Lyrics

`LYRICS_ENABLED = false` gates the Now Playing mode toggle and the Settings section.
The panel, lookup and cache code stay on disk and keep their tests.

## Removed code

- `modules/audio-tags` (Kotlin module), its config, and the Expo autolink entry.
- `src/library/tagWriter.ts`, `src/lib/tagPatch.ts`, their tests, and the tag-write
  paths in `EditTrackScreen`.
- `src/library/exclusions.ts` (replaced by `tracks.status`).
- `src/library/imports.ts` AsyncStorage storage (replaced by DB rows).
- `track_metadata` table and its repo functions (migrated, then dropped or kept
  unused for one release).
- The Import screen's recent imports section and the link-import disabled card.

## Risks

- **SAF behavior:** `Directory.pickDirectoryAsync` returns a directory whose
  file operations must be proven on device, especially create, copy, delete and
  download. If `downloadFileAsync` cannot target SAF, download to cache and copy.
  If the picked grant does not survive a relaunch, take a persistable permission
  through the legacy `StorageAccessFramework` API or a native grant. The picked
  root is a v5 requirement; a persistence failure changes the write path, not the
  feature.
- **Permission loss:** a revoked folder shows as missing files. Detect a missing root
  on launch and prompt to re-pick, rather than marking every track missing.
- **Scan volume:** thousands of rows. Upsert in chunks and never block the UI; show
  progress and allow the app to stay usable during the first scan.
- **Schema migration:** existing favorites, playlists history and artwork must keep
  resolving by id. Test migration with a real v3 database fixture.
- **ytmp3.ge:** third-party, unauthenticated and ephemeral links. Isolate it behind
  one module and assume it can break without breaking the library.
- **Artwork URLs:** remote artwork can fail offline. Local files win; a failed URL
  falls back to generated art.

## Acceptance

- Import a set of MP3s including the one that currently fails: all non-zero files
  import, appear in Library, play after a cold relaunch, and show real titles.
- Rename, retag, change artist/album, and change artwork on a scanned file and an
  imported file: each saves instantly, survives relaunch, and leaves the file bytes
  and filename untouched.
- Delete the underlying file of a track, then try to play it: a warning and delete CTA
  appear, and playing a different track still works.
- Settings shows the real permission state, a working scan toggle, a rescan with a
  result, an accurate exclude-all count, and a storage folder that can be changed and
  moved.
- Hidden tracks open their own page; Restore brings a track back; Clear removes it from
  the app and a rescan does not bring it back; Delete removes the file.
- Create a tag, assign it to tracks, filter the library by it, unassign it, and create
  another from the filter bar. The bar disappears when no track has a tag.
- Import a YouTube link through ytmp3.ge: the MP3 lands in the chosen folder, the title
  and thumbnail come from the response, it plays, and failures are reported.
- Lyrics controls are absent; Recently played is visibly smaller; the Import tab has
  no recent list and returns to Library after a successful import.
- `npm test`, `npx tsc --noEmit`, `npx expo lint`, `npx expo export --platform web`
  pass. Device checks are recorded, not assumed.

## Left to the builder

- Exact SAF download fallback and the device matrix for folder operations.
- Whether the reclaimable-space Clean action ships in v5 or is deferred.
- Whether `track_metadata` is dropped in v4 or left unused for one release.
- The visual treatment of the tag chips and the missing-file row, within the existing
  design system.
- The task breakdown and sequencing; expected to be authored as separate plan
  documents per area.
