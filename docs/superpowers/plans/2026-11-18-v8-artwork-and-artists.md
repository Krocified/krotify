# v8 Artwork and Artists Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let every cover come from the gallery or from files and crop to a square that matches the frame, give artists their own persisted cover, and make artist pages behave like a place ("N songs", back to Collections).

**Architecture:** One `ArtworkSourceSheet` offers Gallery and Files and feeds the existing square cropper, for track, playlist and artist covers. `normalizeCropSource` decodes the picked image once into a cache file, so EXIF rotation and `content://` inputs are resolved before the crop math runs and the preview is the same bitmap that gets cropped. Artist covers live in a new `artist_art` table keyed by a normalized artist name, with a first-track fallback.

**Tech Stack:** Expo SDK 58, `expo-image-picker`, `expo-image-manipulator`, `expo-file-system`, `expo-sqlite`, `node --test`.

**Spec:** `docs/spec.md` §v8 — "Artwork from the gallery", "Cropper that matches its preview", "Artist detail is a place"; §Data model `artist_art`.

## Global Constraints

- `expo-image-picker` is installed with `npx expo install expo-image-picker`; never a bare `npm install`.
- Config plugin blocks `CAMERA` and `RECORD_AUDIO`; no camera feature.
- Never write to an audio file. Covers are new files under `Paths.document`.
- A failed crop or save must leave the previous cover and the track untouched.
- Every pressable has `accessibilityRole` and `accessibilityLabel`.
- Before a task is done: `npm test`, `npx tsc --noEmit`, `npx expo lint` pass.
- Conventional Commits, imperative, under 50 characters, no AI attribution.

## Review Focus

- A photo with EXIF rotation must crop to the square the user framed, not a rotated or offset region.
- A `content://` gallery or files URI must preview and crop, not fail on `Image.getSize`.
- A cover chosen for a playlist must not replace the track's art or another playlist's cover.
- An artist cover must survive a rescan and an artist rename that only changes case or spacing.
- Removing a custom artist cover must fall back to the first track's art, not a blank square.

---

### Task 1: Gallery image source

**Files:**
- Modify: `package.json`, `app.json`
- Modify: `src/lib/artworkInput.ts` (add `PickedImage` and `pickedImageFromAsset`)
- Create: `src/library/imageInput.ts` (native pickers)
- Test: `tests/imageInput.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // src/lib/artworkInput.ts — no React Native imports, so node --test can load it
  export type PickedImage = {
    uri: string;
    name: string;
    mimeType: string;
    sizeBytes: number;
  };
  export type ImagePickerAssetLike = {
    uri: string;
    fileName?: string | null;
    mimeType?: string | null;
    fileSize?: number | null;
  };
  export function pickedImageFromAsset(asset: ImagePickerAssetLike): PickedImage;

  // src/library/imageInput.ts — native wrappers
  export async function pickImageFromGallery(): Promise<PickedImage | null>;
  export async function pickImageFromFiles(): Promise<PickedImage | null>;
  ```

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { pickedImageFromAsset } from '../src/lib/artworkInput.ts';

test('keeps a provided name, mime and size', () => {
  assert.deepEqual(
    pickedImageFromAsset({
      uri: 'file:///a.heic',
      fileName: 'Cover.HEIC',
      mimeType: 'image/heic',
      fileSize: 1234,
    }),
    { uri: 'file:///a.heic', name: 'Cover.HEIC', mimeType: 'image/heic', sizeBytes: 1234 },
  );
});

test('falls back to a generated name and mime from the extension', () => {
  const picked = pickedImageFromAsset({ uri: 'content://x/photo.png' });
  assert.equal(picked.mimeType, 'image/png');
  assert.match(picked.name, /^artwork-\d+\.png$/);
  assert.equal(picked.sizeBytes, 0);
});

test('unknown extension falls back to image/jpeg and .jpg', () => {
  const picked = pickedImageFromAsset({ uri: 'content://x/blob' });
  assert.equal(picked.mimeType, 'image/jpeg');
  assert.match(picked.name, /\.jpg$/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/imageInput.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Install and configure the picker**

Run: `npx expo install expo-image-picker`
Add to `app.json` plugins:

```json
["expo-image-picker", { "cameraPermission": false, "microphonePermission": false }]
```

Do not add photo-library permissions copy; Android 13+ uses the system photo picker.

- [ ] **Step 4: Implement the helpers**

Put `PickedImage`, `ImagePickerAssetLike` and `pickedImageFromAsset` in `src/lib/artworkInput.ts` so the test does not import an Expo native module. Then `src/library/imageInput.ts` exports the two async pickers:

`pickImageFromGallery` calls `ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 })` and returns `null` when cancelled. `pickImageFromFiles` calls `DocumentPicker.getDocumentAsync({ type: 'image/*', copyToCacheDirectory: false })` and maps the first asset (it already has `name`, `mimeType`, `size`). Both return `pickedImageFromAsset`. Generate the fallback name with `Date.now()` and the extension from the mime map `image/png → png`, `image/webp → webp`, `image/heic → heic`, `image/gif → gif`, else `jpg`.

- [ ] **Step 5: Run tests, typecheck and lint**

Run: `npm test && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 6: Prebuild note**

Run: `npx expo prebuild --platform android` only if the dev build has not been created since adding the plugin. Never hand-edit `android/`.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json app.json src/lib/artworkInput.ts src/library/imageInput.ts tests/imageInput.test.ts
git commit -m "feat(artwork): add gallery image source"
```

---

### Task 2: One artwork source sheet

**Files:**
- Create: `src/components/ArtworkSourceSheet.tsx`
- Modify: `src/screens/EditTrackScreen.tsx`
- Modify: `src/components/PlaylistEditSheet.tsx`

**Interfaces:**
- Consumes: `PickedImage`, `pickImageFromGallery`, `pickImageFromFiles` (Task 1); `validateArtworkInput` from `src/lib/artworkInput.ts`.
- Produces:
  ```ts
  type Props = {
    visible: boolean;
    canRemove?: boolean;
    onGallery: () => void;
    onFiles: () => void;
    onRemove?: () => void;
    onClose: () => void;
  };
  ```

- [ ] **Step 1: Build the sheet**

A `Sheet` titled `Cover art` with rows: Gallery (`images-outline`), Files (`folder-open-outline`), optional Remove (`trash-outline`, `tone: destructive`). Every row closes the sheet before calling its handler. Accessibility labels: `Choose from gallery`, `Choose from files`, `Remove cover`.

- [ ] **Step 2: Wire track details**

Replace the direct `File.pickFileAsync` call in `EditTrackScreen.chooseArtwork` with the sheet: Gallery → `pickImageFromGallery`, Files → `pickImageFromFiles`. Validate with `validateArtworkInput({ mimeType: picked.mimeType, sizeBytes: picked.sizeBytes })`; on failure set the existing error text; on success `setCropUri(picked.uri)`. Keep the existing cropper and `persistTrackArtwork` flow. Add a Remove action that sets the artwork selection back to the track's original value.

- [ ] **Step 3: Wire playlist covers**

Replace `chooseCover`'s `DocumentPicker` call with the same two sources and the existing `setCropUri(asset.uri)` path. Keep `removeCover` as the Remove action so staged-cover cleanup stays intact.

- [ ] **Step 4: Run checks and a device check**

Run: `npm test && npx tsc --noEmit && npx expo lint`
Expected: PASS. On a dev build, change a track cover from the gallery and a playlist cover from files; both reach the cropper and save.

- [ ] **Step 5: Commit**

```bash
git add src/components/ArtworkSourceSheet.tsx src/screens/EditTrackScreen.tsx src/components/PlaylistEditSheet.tsx
git commit -m "feat(artwork): choose gallery or files for covers"
```

---

### Task 3: Cropper that matches its preview

**Files:**
- Modify: `src/lib/crop.ts` (export the base scale used by both preview and crop)
- Modify: `src/library/cropArtwork.ts` (`normalizeCropSource`)
- Modify: `src/components/SquareImageCropper.tsx`
- Test: `tests/crop.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // src/lib/crop.ts
  export function baseScaleFor(imageWidth: number, imageHeight: number, viewport: number): number;

  // src/library/cropArtwork.ts
  export type CropSource = { uri: string; width: number; height: number };
  export async function normalizeCropSource(uri: string): Promise<CropSource>;
  export async function cropSquare(uri: string, rect: CropRect): Promise<File>; // kept
  ```

- [ ] **Step 1: Add the failing geometry tests**

Append to `tests/crop.test.ts`:

```ts
test('tall image keeps a centered square at scale 1', () => {
  assert.deepEqual(
    computeCropRect({ imageWidth: 1000, imageHeight: 3000, viewport: 300, transform: transform() }),
    { originX: 0, originY: 1000, width: 1000, height: 1000 },
  );
});

test('baseScaleFor fits the shorter side and is shared by preview and crop', () => {
  assert.equal(baseScaleFor(2000, 1000, 300), 0.3);
  assert.equal(baseScaleFor(1000, 3000, 300), 0.3);
  assert.equal(baseScaleFor(0, 1000, 300), 0);
});

test('edge pan on a tall image keeps the crop inside the bitmap', () => {
  const rect = computeCropRect({
    imageWidth: 1000,
    imageHeight: 3000,
    viewport: 300,
    transform: transform(2, 0, 99999),
  });
  assert.ok(rect.originY >= 0);
  assert.ok(rect.originY + rect.height <= 3000);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test -- tests/crop.test.ts`
Expected: FAIL — `baseScaleFor` is not exported.

- [ ] **Step 3: Implement `baseScaleFor` and use it**

Extract `Math.max(viewport / imageWidth, viewport / imageHeight)` from `clampTransform` and `computeCropRect` into `baseScaleFor`, returning `0` for non-positive dimensions. Both functions call it.

- [ ] **Step 4: Run to verify they pass**

Run: `npm test -- tests/crop.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement `normalizeCropSource`**

```ts
const context = ImageManipulator.manipulate(uri);
const ref = await context.renderAsync();
const saved = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 1 });
return { uri: saved.uri, width: ref.width, height: ref.height };
```

This applies EXIF rotation through the native loader and converts `content://` into a cache file. Cache files are deleted when the cropper closes.

- [ ] **Step 6: Rework `SquareImageCropper`**

On show: reset transform, call `normalizeCropSource(uri)`, then set `source` state `{ uri, width, height }`. Render the preview as an absolutely positioned image whose layout size is `width * baseScaleFor(width, height, viewport)` and `height * baseScaleFor(...)`, centered with `position: absolute` offsets, and apply only zoom and pan as transforms. No `resizeMode="cover"` — the layout now matches the crop model exactly. On save, use the normalized `width`/`height` in `computeCropRect` and pass the normalized `uri` to `cropSquare`. Delete the previous normalized cache file on cancel, save and unmount. Show `Could not read that image` when normalization fails and `Could not crop the image` when the crop fails.

- [ ] **Step 7: Run checks and a device check**

Run: `npm test && npx tsc --noEmit && npx expo lint`
Expected: PASS. Device (record in `docs/research/v8-device-checks.md`): crop a rotated camera photo, a tall screenshot and a wide photo at 1x, 2x and an edge pan; the saved square matches the frame each time.

- [ ] **Step 8: Commit**

```bash
git add src/lib/crop.ts src/library/cropArtwork.ts src/components/SquareImageCropper.tsx tests/crop.test.ts
git commit -m "fix(artwork): crop the square that is framed"
```

---

### Task 4: Artist art storage

**Files:**
- Modify: `src/db/schema.ts` (table + `DB_VERSION = 5`)
- Create: `src/library/artistArtwork.ts`
- Test: `tests/artistArt.test.ts`
- Modify: `tests/migration.test.ts` (`DB_VERSION` assertion)

**Interfaces:**
- Produces:
  ```ts
  export const ARTIST_ART_TABLE_SQL = `CREATE TABLE IF NOT EXISTS artist_art (...)`;
  export const ARTIST_ART_UPSERT_SQL = `INSERT INTO artist_art ... ON CONFLICT(artistKey) ...`;
  export const ARTIST_ART_LIST_SQL = 'SELECT artistKey, artworkUri FROM artist_art';

  export async function listArtistArt(): Promise<Map<string, string>>;
  export async function saveArtistArt(artistKey: string, source: File): Promise<string>;
  export async function clearArtistArt(artistKey: string): Promise<void>;
  ```

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { DB_VERSION } from '../src/db/schema.ts';

const source = readFileSync(new URL('../src/library/artistArtwork.ts', import.meta.url), 'utf8');
const table = /export const ARTIST_ART_TABLE_SQL = `([\s\S]*?)`;/.exec(source)?.[1];
const upsert = /export const ARTIST_ART_UPSERT_SQL = `([\s\S]*?)`;/.exec(source)?.[1];

test('artist_art upserts one row per key', () => {
  assert.ok(table && upsert);
  const db = new DatabaseSync(':memory:');
  db.exec(table);
  db.prepare(upsert).run('the band', 'file:///a.jpg', 1);
  db.prepare(upsert).run('the band', 'file:///b.jpg', 2);
  const rows = db.prepare('SELECT artistKey, artworkUri FROM artist_art').all();
  assert.deepEqual(rows, [{ artistKey: 'the band', artworkUri: 'file:///b.jpg' }]);
  db.close();
});

test('database version is 5', () => {
  assert.equal(DB_VERSION, 5);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/artistArt.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Add the table**

In `src/db/schema.ts` append to `LEGACY_TABLE_SQL`:

```sql
CREATE TABLE IF NOT EXISTS artist_art (
  artistKey TEXT PRIMARY KEY,
  artworkUri TEXT NOT NULL,
  updatedAt INTEGER NOT NULL
);
```

Bump `DB_VERSION` to `5`. The existing `migrate` runs `SCHEMA_SQL` for older databases, so no separate ALTER is needed. Update `tests/migration.test.ts`.

- [ ] **Step 4: Implement the repo**

`saveArtistArt` copies the source into `new Directory(Paths.document, 'artist-artwork')` as `artist-${hashString(artistKey).toString(36)}-${Date.now()}.jpg`, deletes older files for the same hash, upserts the row, and returns the new URI. `clearArtistArt` deletes the row and the file for that hash. `listArtistArt` returns a `Map` from `ARTIST_ART_LIST_SQL`.

- [ ] **Step 5: Run to verify it passes**

Run: `npm test -- tests/artistArt.test.ts && npm test -- tests/migration.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/db/schema.ts src/library/artistArtwork.ts tests/artistArt.test.ts tests/migration.test.ts
git commit -m "feat(artists): persist artist covers"
```

---

### Task 5: Artist identity and view helpers

**Files:**
- Create: `src/lib/artistIdentity.ts`
- Test: `tests/artistIdentity.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function artistArtKey(name: string): string;
  export function artistSongsLabel(count: number): string;
  export function applyArtistArt<T extends { key: string; name: string }>(
    artists: readonly T[],
    covers: ReadonlyMap<string, string>,
  ): (T & { artworkUri?: string })[];
  ```

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyArtistArt,
  artistArtKey,
  artistSongsLabel,
} from '../src/lib/artistIdentity.ts';

test('artistArtKey folds case and spacing', () => {
  assert.equal(artistArtKey('  The   Band '), 'the band');
  assert.equal(artistArtKey('The Band'), 'the band');
});

test('artistSongsLabel pluralizes', () => {
  assert.equal(artistSongsLabel(1), '1 song');
  assert.equal(artistSongsLabel(4), '4 songs');
  assert.equal(artistSongsLabel(0), '0 songs');
});

test('applyArtistArt matches by folded key and omits missing covers', () => {
  const artists = [
    { key: 'The Band', name: 'The Band' },
    { key: 'Other', name: 'Other' },
  ];
  const covers = new Map([['the band', 'file:///art.jpg']]);
  assert.deepEqual(applyArtistArt(artists, covers), [
    { key: 'The Band', name: 'The Band', artworkUri: 'file:///art.jpg' },
    { key: 'Other', name: 'Other' },
  ]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/artistIdentity.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the three helpers**

`artistArtKey` trims, collapses internal whitespace with `/\s+/g`, then lowercases. `artistSongsLabel` uses `song`/`songs`. `applyArtistArt` maps `artistArtKey(artist.name)` into the covers map and spreads the URI only when found.

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- tests/artistIdentity.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/artistIdentity.ts tests/artistIdentity.test.ts
git commit -m "feat(artists): add identity and label helpers"
```

---

### Task 6: Artist detail is a place

**Files:**
- Modify: `src/screens/CollectionsScreen.tsx`
- Modify: `src/components/CollectionHeader.tsx` (optional artwork press)
- Modify: `src/AppShell.tsx` (pass `registerBackInterceptor`)
- Modify: `src/screens/EditTrackScreen.tsx` only if the source sheet needs a shared export (no)

**Interfaces:**
- Consumes: Tasks 1–5; `selectionBackHandler` from plan 1 Task 1.
- Produces: `CollectionsScreen` prop `registerBackInterceptor?: (handler: (() => boolean) | null) => void`; `CollectionHeader` prop `onPressArtwork?: () => void`.

- [ ] **Step 1: Back to Collections**

Add the interceptor prop and:

```ts
useEffect(() => {
  if (!registerBackInterceptor) return;
  registerBackInterceptor(
    selectionBackHandler(selection !== null, () => setSelection(null)),
  );
  return () => registerBackInterceptor(null);
}, [registerBackInterceptor, selection]);
```

Pass it from `AppShell`. Leave `resolveBack` untouched: Collections to Library still goes through `tab-to-library`, and the interceptor consumes artist-level back first.

- [ ] **Step 2: Drop album mentions**

Replace `artistMeta` with `artistSongsLabel(artist.tracks.length)` for both the row and the hero, including accessibility labels. Do not change `buildArtists` or the unwired `CatalogScreen`.

- [ ] **Step 3: Load and apply artist covers**

```ts
const [artistCovers, setArtistCovers] = useState<ReadonlyMap<string, string>>(new Map());
useEffect(() => {
  let cancelled = false;
  listArtistArt()
    .then((covers) => { if (!cancelled) setArtistCovers(covers); })
    .catch(() => {});
  return () => { cancelled = true; };
}, []);
const artists = useMemo(
  () => applyArtistArt(buildArtists(tracks), artistCovers),
  [tracks, artistCovers],
);
```

Use `artist.artworkUri` for the row cover and the hero (fall back to `artist.tracks[0]?.artworkUri`).

- [ ] **Step 4: Edit the hero cover**

Add `onPressArtwork` to `CollectionHeader`: when provided, wrap `CoverArt` in a `Pressable` with `accessibilityLabel="Change artist cover"`. In the artist detail, open `ArtworkSourceSheet` with Gallery, Files and Use default:

- Gallery/Files → `pickImageFromGallery`/`pickImageFromFiles` → validate with `validateArtworkInput` → `SquareImageCropper` → `saveArtistArt(artistArtKey(artist.name), file)` → update `artistCovers` with the returned URI.
- Use default → `clearArtistArt(artistArtKey(artist.name))` → remove the key from `artistCovers`.

Failures show the existing inline message pattern (`Could not save the cover.`).

- [ ] **Step 5: Run checks and a device check**

Run: `npm test && npx tsc --noEmit && npx expo lint`
Expected: PASS. Device: set an artist cover, rescan, confirm it stays; change the artist tag's case in track details, confirm the cover still applies.

- [ ] **Step 6: Commit**

```bash
git add src/screens/CollectionsScreen.tsx src/components/CollectionHeader.tsx src/AppShell.tsx
git commit -m "feat(artists): covers, songs meta and back to collections"
```

---

### Task 7: Record the artwork evidence

**Files:**
- Modify: `docs/research/v8-device-checks.md`

- [ ] **Step 1: Record**

Device, Android version, build (`versionCode`), date, outcome for: gallery pick, files pick, EXIF-rotated crop, tall/wide crop, playlist cover isolation, artist cover persistence across rescan and case-only rename, Use default.

- [ ] **Step 2: Commit**

```bash
git add docs/research/v8-device-checks.md
git commit -m "docs: record v8 artwork device checks"
```

---

## Self-Review

- Spec coverage: gallery source (Tasks 1–2), cropper parity (Task 3), artist cover + persistence + fallback (Tasks 4–6), artist back (Task 6), "N songs" (Task 6).
- Interfaces: `PickedImage` (Task 1) is consumed by Task 2; `normalizeCropSource` (Task 3) is internal to the cropper; `artistArtKey` (Task 5) is used by Task 6 for both save and clear; `ARTIST_ART_*_SQL` names match the test in Task 4.
- Review Focus: EXIF (Task 3 device check), `content://` (Task 3 Step 5 + device check), playlist isolation (Task 2 Step 3 keeps staged playlist files), rescan/rename (Task 4 key + Task 6 device check), Use default (Task 6 Step 4).
