# v7 UX and Library Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the seven UX review items added to v7: an inline create and multi-select playlist picker, tag management in Settings, a Library that is only the song list plus tag pills, hidden link import, a tappable version with a tech stack page and credit, and a count-free Hidden tracks row.

**Architecture:** UI-only changes over the existing v7 foundation. The Library loses its rails, not its data: `RecentlyPlayed` is unwired, and Liked/Playlists/Artists screens stay on disk for the later Home-style section. The playlist picker owns inline creation and multi-select against `src/db/repo.ts`. Tags gain a delete path in `src/tags/repo.ts`; the existing `ON DELETE CASCADE` on `track_tags` removes assignments. Link import and its Settings fields are hidden behind a single flag in `src/lib/features.ts`. The About version becomes a press target that opens a layered Tech stack page, sharing one watermark component.

**Tech Stack:** Expo SDK 58, React Native 0.88, TypeScript, `expo-sqlite`, Ionicons, existing sheet and screen primitives. No new dependency.

**Spec:** `docs/spec.md` §v7 (source of truth).

**Prerequisite:** the v5/v5.1 surfaces as they stand. This plan does not build lyrics, LRCLIB, ambient color, the cropper, navbar blur, the Library song-row art layout, or the Playlists cover grid; those remain separate v7 work.

## Decisions Locked

- **Library is the song list.** Remove the Recently played rail, the Liked Songs row and the Playlists rail from `LibraryScreen`. Keep the tag pills and the flat track list. Keep `LikedScreen`, `PlaylistsScreen` and their routes. A Collections control in the header keeps them reachable; the playlists-and-nav plan owns that control and the Library header wiring.
- **History is kept.** Do not drop the `history` table or the play-history writes. Only the Library surface goes away.
- **Playlist creation is one step.** The New playlist row validates a non-empty trimmed name, creates the playlist, adds the current track, and reports a single result. It never creates an empty playlist on failure.
- **Multi-select is explicit.** Rows become checkboxes. Add is disabled with no selection. Each selected playlist is attempted; the result names partial failures instead of claiming full success. The sheet stays open so the user can correct; the existing Done closes it.
- **Nothing duplicates a membership.** Adding to a playlist that already has the track is reported as already present, not as a failure.
- **Tag delete cascades without touching files.** `deleteTag` deletes the `tags` row; `track_tags.tagId` already references `tags(id) ON DELETE CASCADE`. No file, track or metadata write happens.
- **Tag creation in Settings is the same validation as the editor.** Reuse `normalizeTagName` and `createTag`.
- **Link import is hidden, not deleted.** Put `LINK_IMPORT_ENABLED = false` in `src/lib/features.ts` beside `LYRICS_ENABLED`. Import renders no link card, Settings renders no link-service fields, and no empty section header remains. The server, module and tests stay.
- **The version is a button.** About's version row opens a Tech stack page layered over Settings, with back returning to Settings. Hidden tracks keeps the same layering behavior.
- **Credit is fixed text.** Both About and the Tech stack page show `Created by Krocified`. No link, no external navigation.
- **No new native code and no new dependency.**

## Global Constraints

- Android first; the web export must keep working for the Playwright suite.
- Every task ends with `npm test && npx tsc --noEmit && npx expo lint && npx expo export --platform web`.
- One conventional commit per task. No push.
- Reuse the existing sheet, screen, card and row styles. Do not introduce a second component library.

## Review Focus

- Creating a playlist and then failing to add the track must not leave an empty playlist.
- Adding to a playlist that already contains the track must report "already there", not duplicate the row or claim failure.
- Deleting the tag that is currently filtering the Library must clear the filter, not show an empty list.
- Hiding link import must not leave an empty section header or a dead Import card.
- Back from the Tech stack page must return to Settings, never the base screen.

## Tasks

### 1. Library becomes the song list

- [ ] Remove the `RecentlyPlayed` render and `recentTracks` plumbing from `src/screens/LibraryScreen.tsx`.
- [ ] Remove the Liked Songs row and the Playlists rail, including their props and handlers. Keep the tag filter bar above the song list.
- [ ] Keep `onOpenLiked` and `onOpenPlaylists` available for the later Home-style section; do not delete the screens, routes or repository calls.
- [ ] Update `src/screens/LibraryScreen.tsx` tests and the web demo assertions that expect those rows.
- [ ] Remove the now-unused imports, styles and scroll offsets. Lint must be clean.

### 2. Library song rows

- [ ] Update `src/components/TrackRow.tsx` to the v7 row: cover, title, and `artist · duration` on the second line.
- [ ] Move duration off the far right. Add an ellipsis button on the right that calls the same handler as long press, with an accessible name like `More options for <title>`.
- [ ] Keep the existing selected, playing and missing-file states.
- [ ] Make sure the ellipsis does not also trigger row selection.

### 3. Playlist picker: inline create and multi-select

- [ ] Refactor `PlaylistPickerSheet` in `src/components/TrackActionsSheet.tsx` into checkbox rows plus a New playlist row with an inline name field.
- [ ] On New playlist Add: trim and validate the name, call `createPlaylist`, add the track with `addPlaylistTrack`, and append the playlist to the list with its checked state set. If the add fails, delete the just-created playlist before reporting, so no empty playlist is left behind.
- [ ] Add button: attempt every checked playlist, using `listPlaylistTracks` to skip existing memberships, and report `Added to N playlists` with named partial failures.
- [ ] Disable Add when nothing is checked or a batch is running. Keep Done as the only close action.
- [ ] Keep the current accessible labels and add checked state to each row.
- [ ] Cover both entry points: the hold menu in `AppShell` and the Now Playing bookmark.
- [ ] Add unit tests for the selection-to-result reducer; keep DB calls thin and injected as the existing repo tests do.

### 4. Tags in Settings

- [ ] Add `deleteTag(id: string)` to `src/tags/repo.ts`; it deletes the tag row and returns after the cascade. Add a repo test proving the assignments disappear and the track remains.
- [ ] Add a Tags section to `src/screens/SettingsScreen.tsx` listing tags with active counts from `listTagsWithCounts`.
- [ ] Add a create field that reuses `normalizeTagName` and `createTag`, with the same duplicate and empty feedback as the editor.
- [ ] Add a delete control per tag with an in-app confirmation. After delete, refresh the list and the filter bar assignments; if the deleted tag was the active Library filter, reset the filter to All.
- [ ] Keep the section hidden when there are no tags except for the create control and empty text.

### 5. Hide link import and its Settings fields

- [ ] Add `LINK_IMPORT_ENABLED = false` to `src/lib/features.ts`.
- [ ] In `src/screens/ImportScreen.tsx`, render no link card and no link empty state when the flag is off. The local import card is the whole surface.
- [ ] In `src/screens/SettingsScreen.tsx`, render no link-service URL/token fields and no link section header when the flag is off.
- [ ] Leave the server, `src/imports/link.ts`, storage settings reads and their tests in place.
- [ ] Add a test or assertion that both surfaces are absent in the default build.

### 6. About: tech stack page and credit

- [ ] Make the version row in About pressable, labeled `Krotify <version>, view tech stack`, and open a layered Tech stack page over Settings.
- [ ] Create the Tech stack page from the Platform & stack table in `docs/spec.md`: platform, framework, language, scan, import, file ops, reorder, playback, metadata/art, persistence, visuals. Move the list into one typed constant in `src/lib/techStack.ts` so the page and tests share it.
- [ ] Keep the existing Release ABI row.
- [ ] Add a `CreatedByKrocified` watermark component and render it on About and the Tech stack page.
- [ ] Wire back so Tech stack closes to Settings, and back from Settings returns to the previous screen.
- [ ] Add the route to the shell's back resolver and to the layered-screen blur target.

### 7. Hidden tracks row loses its count

- [ ] Change the Settings row title to plain `Hidden tracks`; remove the count from the title and its accessibility label.
- [ ] Keep `N hidden tracks` on the Hidden tracks page.
- [ ] Update the label helper and its tests.

### 8. v7 E2E coverage

- [ ] Extend the specs in `docs/superpowers/plans/2026-11-17-v7-playwright-e2e.md`:
  - Library has no Recently played, Liked Songs row or Playlists rail.
  - Picker creates a playlist and adds the track in one press.
  - Picker adds to two playlists in one press and names a partial failure.
  - Settings creates and deletes a tag; the assignment disappears from the song.
  - Import has no link card and Settings has no link-service fields.
  - Version opens Tech stack; both pages show `Created by Krocified`.
  - Hidden tracks row has no count.
- [ ] Keep the existing regression tests for Settings layers and the action sheet.

## Acceptance

- Library shows only the tag pills and the flat song list; Liked, Playlists and Recently played are unreachable from it.
- The picker creates a playlist and adds the track, and adds one track to several playlists in a single press with honest results.
- Settings can create and delete tags; deletion clears assignments everywhere and never touches audio files.
- No link import card and no link-service fields are visible; the code path still exists behind the flag.
- The About version opens a Tech stack page, and About plus Tech stack show `Created by Krocified`.
- The Settings Hidden tracks row has no count.
- `npm test`, `npx tsc --noEmit`, `npx expo lint` and the web export pass.
