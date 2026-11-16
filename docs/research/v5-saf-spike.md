# v5 SAF Dev-Build Spike

**Status:** device checks NOT RUN. No Android device or emulator was attached to
this session, so nothing in the result table is a pass and no observed output is
recorded.
**Date:** 2026-11-16
**Worktree:** `.worktrees/v5-storage` on `feat/v5-storage`
**Base commit:** `4b3c244`
**Brief:** `.superpowers/sdd/2026-11-16-v5-track-store-and-imports/task-4-brief.md`
**Plan:** `docs/superpowers/plans/2026-11-16-v5-track-store-and-imports.md`

## Verification boundary

This document exists so the spike can be run on a real Android device and the
results pasted in. It is not evidence of a device pass. The four questions below
are unanswered until a development build is installed and each operation is
observed:

1. Does `Directory.pickDirectoryAsync()` return a directory the app can use?
2. Do create, write, copy, list and delete work inside that picked directory?
3. Does `File.downloadFileAsync()` accept a SAF destination?
4. Does the picked directory URI still work after an app relaunch?

No temporary `__DEV__` spike button was added to `SettingsScreen` in this
session because there was no dev client to run it against. The screen is
unchanged. Add the action from the procedure below, run it on a device, and
remove it before committing the spike result.

## Device under test

| Field | Value |
|---|---|
| Device model | PENDING |
| Android version | PENDING |
| App build | PENDING (`npx expo run:android`, development build) |
| Storage root URI shape | PENDING |

## Procedure

### 1. Build and install the dev client

```bash
npx expo run:android
```

Expected: the app installs and launches. A Metro or Gradle failure stops the
spike. Record the exact failure and do not continue.

### 2. Temporary `__DEV__` spike action

Add a button in `src/screens/SettingsScreen.tsx` gated by `__DEV__` that runs
this in order and renders the JSON on screen:

```ts
const directory = await Directory.pickDirectoryAsync();
const probe = new File(directory, 'krotify-spike.txt');
probe.create({ overwrite: true });
await probe.write('krotify');
const listed = directory.list().map((entry) => entry.name);
const copySource = new File(Paths.cache, 'krotify-spike-source.txt');
copySource.create({ overwrite: true });
await copySource.write('copy');
const copyTarget = new File(directory, 'krotify-spike-copy.txt');
await copySource.copy(copyTarget);
const copySize = copyTarget.size;
copyTarget.delete();
probe.delete();
return { uri: directory.uri, listed, copySize };
```

Record `directory.uri` exactly as shown. Do not redact the scheme or authority:
the URI shape decides whether a raw URI can be reconstructed after relaunch.

### 3. Prove a download into the picked folder

Serve a local file so no third-party URL is involved:

```bash
mkdir -p /tmp/opencode/saf-spike
dd if=/dev/urandom of=/tmp/opencode/saf-spike/spike.bin bs=1024 count=16
npx --yes serve -l 8080 /tmp/opencode/saf-spike
```

Find the dev machine LAN address:

```bash
ip route get 1.1.1.1
```

On the device, try the direct path first:

```ts
await File.downloadFileAsync(
  'http://<LAN-IP>:8080/spike.bin',
  new File(directory, 'spike.bin'),
  { signal: new AbortController().signal },
);
```

If it rejects or writes zero bytes, download to `Paths.cache` and copy into the
picked directory, and record that the fallback is required for this device.
Confirm the destination size is `16384` bytes in whichever path succeeds.

### 4. Prove persistence across relaunch

Store the picked `directory.uri` in temporary screen state and in `AsyncStorage`
under a spike-only key. Kill and relaunch the app, read the key, construct
`new Directory(uri)` and list it.

- If listing works, record the URI and the listed names.
- If the URI is unreadable or empty, record the exact error, then try the legacy
  `StorageAccessFramework.requestDirectoryPermissionsAsync()` path, or a native
  `takePersistableUriPermission` if the legacy helper also fails to persist.
  Re-run the relaunch check with that path and record it.
- If both APIs fail on the device, stop and report the exact failure. The
  picked-root setting stays in the product; a small native storage helper is
  then planned instead of dropping the feature.

### 5. Remove the temporary code

Delete the spike button and the spike-only key. `git diff` must show only this
evidence document changed.

## Result table

A row is not a pass without the observed output pasted next to it. Every row
below is `PENDING` until a device run happens.

| # | Question | Operation | Expected | Status | Observed output |
|---|---|---|---|---|---|
| 1 | Picker returns a usable directory | `Directory.pickDirectoryAsync()` | Resolves to a directory with a `content://` URI on Android | PENDING: not run | none |
| 2a | Create works in the picked directory | `probe.create({ overwrite: true })` | No throw; file appears | PENDING: not run | none |
| 2b | Write works | `await probe.write('krotify')` | No throw | PENDING: not run | none |
| 2c | List sees the probe | `directory.list()` | `krotify-spike.txt` is in the names | PENDING: not run | none |
| 2d | Copy into the picked directory works | `copySource.copy(copyTarget)` | No throw; `copySize` is 4 | PENDING: not run | none |
| 2e | Delete works | `copyTarget.delete()`, `probe.delete()` | No throw; the names disappear on the next list | PENDING: not run | none |
| 3 | Download writes directly to SAF | `File.downloadFileAsync(url, new File(directory, 'spike.bin'))` | Resolves; destination size is 16384 bytes | PENDING: not run | none |
| 3f | Cache-then-copy fallback | Download to `Paths.cache`, then copy into the picked directory | Destination size is 16384 bytes | PENDING: not run | none |
| 4 | URI survives relaunch | Store the URI, kill, relaunch, `new Directory(uri).list()` | The directory is readable and still lists its files | PENDING: not run | none |
| 4f | Persistable grant fallback | Legacy SAF grant or native `takePersistableUriPermission` | The URI is readable after relaunch through the fallback | PENDING: not run | none |

## Download path decision

PENDING. Task 5 implements both paths, so either device result is supported:

- `downloadOwnedFile` tries `File.downloadFileAsync(url, destination)` first.
- On failure it downloads to `Paths.cache`, copies into the root with
  `storeOwnedFile`, deletes the cache file, and removes a partial destination.

If row 3 passes, the direct path is the normal path and the fallback is a safety
net. If row 3 fails, the fallback is required and must stay. The fallback is
kept regardless of the spike outcome.

## Persistence answer

PENDING. The chosen-root feature is implemented and does not depend on this
answer: `storageRootUri`, `storageRootName` and `storageRootKind` are persisted
in the `settings` table. If the raw URI is not readable after relaunch, the
write path changes to a persisted-grant URI, not the feature.

## Failure capture

For any failing row, capture both logs before changing code:

```bash
adb logcat -c
# reproduce the failing step
adb logcat -b crash > crash-<row>.log
adb logcat -d > normal-<row>.log
```
