# GitHub Actions Release Workflow Plan

**Goal:** Every push to `main` publishes a new minor version of Krotify as a
signed APK attached to a GitHub release. A manual dispatch can publish a major
(or patch) version instead.

**Spec:** `docs/spec.md` (build constraints, versioning expectations)

## Decisions

- **Version source of truth:** the latest `vX.Y.Z` git tag. The workflow computes
  the next version from it; `app.json` stays at its checked-in value and is
  overridden only inside the CI workspace. No bot commits, so no workflow loops.
- **Push to `main`:** derive the bump from Conventional Commits since the last
  tag. Breaking change → major, `feat` → minor, otherwise patch.
- **Manual dispatch:** input `bump` with `auto | major | minor | patch`, default
  `auto`. `auto` uses the commit analysis; the explicit choices force a bump
  even when the commits would not.
- **Android versionCode:** `major * 10000 + minor * 100 + patch`, so it grows
  monotonically with the tag and never needs a stored counter.
- **APK:** `assembleRelease`, universal (all ABIs) so any device installs it.
  arm64-only builds can come later as a size optimization.
- **Signing:** a real release keystore, not the debug keystore. Without it,
  updates cannot install over an existing build. The keystore lives in GitHub
  Actions secrets.
- **Release:** tag `vX.Y.Z`, title `Krotify X.Y.Z`, notes from the commits since
  the previous tag, APK plus a `.sha256` file attached.
- **Quality gate:** tests, typecheck, and lint run before the build. A red check
  stops the release.

## Workflow shape

`.github/workflows/release.yml`

```yaml
name: Release
on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      bump:
        description: Version bump
        type: choice
        options: [auto, major, minor, patch]
        default: auto

permissions:
  contents: write

concurrency:
  group: release-main
  cancel-in-progress: false
```

Jobs:

1. **version**: checkout with full history and tags, find the latest `v*` tag,
   read commits from that tag to HEAD, classify them, apply the bump, export
   `version` and `versionCode` as job outputs.
2. **verify**: Node 24, `npm ci`, `npm test`, `npx tsc --noEmit`, `npx expo lint`.
3. **build**: Java 17, Android SDK (platform 37, build-tools 37, NDK 27.1),
   Gradle cache, `npx expo prebuild -p android`, patch `app.json` version and
   versionCode, inject the release keystore, `./gradlew assembleRelease`.
4. **release**: create the tag and release with `gh release create`, upload
   `app-release.apk` and its sha256, write notes grouped from commits since the
   previous tag.

## Required secrets

| Secret | Purpose |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | base64 of the release `.jks` |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password |
| `ANDROID_KEY_ALIAS` | key alias |
| `ANDROID_KEY_PASSWORD` | key password |

The workflow writes the keystore to `android/app/release.keystore` and sets the
signing config through Gradle properties, never in the repo.

## Versioning rules

Bump detection from commits (`git log <last-tag>..HEAD`), highest wins:

| Change in range | Bump |
|---|---|
| Any `type!: ...` subject or a `BREAKING CHANGE:` footer | major |
| Any `feat:` commit | minor |
| Only `fix:`, `perf:`, `refactor:`, `chore:`, `docs:`, `test:`, `build:`, `ci:`, `style:` | patch |

- A manual dispatch with `major`, `minor` or `patch` overrides detection.
- Merge commits and `revert:` are ignored for classification, but still count as
  changes; a range with no classifiable commit falls back to patch.
- No tag yet: start from `v0.1.0`, then apply the detected bump.
- The tag is created only if the build succeeded.
- Re-running a failed workflow recomputes from tags; it does not create the same
  version twice because the failed run never tagged.

## Failure modes

- **Duplicate releases on a rerun:** derive the version from tags, not from a
  run counter, and refuse to overwrite an existing tag.
- **Signing drift:** use one keystore stored as a secret. Debug signing breaks
  in-place upgrades.
- **SDK drift:** pin platform/build-tools/NDK versions in the workflow, matching
  the local build notes (`expo prebuild` output) rather than relying on latest.
- **Metadata library conflict:** the Media3 exclusion plugin
  (`plugins/with-media3-exclude.js`) must be present; the workflow does not
  bypass prebuild.
- **Long builds:** cache Gradle and npm. First run is cold, later runs are
  minutes.

## Acceptance

- Push a trivial commit to `main`: a `v0.x.0` tag appears, the release has an
  installable APK, and `adb install -r` upgrades the previous build.
- A `feat:` commit on `main` produces a minor release; a `fix:` produces a
  patch release; a `feat!:` or `BREAKING CHANGE:` produces a major release.
- Dispatch with `major`: next release is a major bump, whatever the commits say.
- A failing test run produces no tag and no release.
- The APK reports the expected `versionName` and `versionCode`
  (`aapt dump badging`).

## Tasks

1. Create the release keystore and add the four secrets.
2. Add `.github/workflows/release.yml` implementing the four jobs.
3. Add `scripts/next-version.mjs` (pure, testable): parse Conventional Commit
   subjects and footers, classify the range, accept an override, and return
   `{ version, versionCode, bump }`.
4. Add `tests/version.test.ts`: feat → minor, fix → patch, `!` and
   `BREAKING CHANGE:` → major, mixed feat plus breaking → major, chore-only →
   patch, manual override beats detection, first release from no tag.
5. Run the workflow once via dispatch on `patch`, verify the release and APK,
   then leave push-to-main enabled.
6. Add a short release section to `README.md` pointing at the workflow.

## Open questions

- Whether docs/chore-only pushes should bump patch or skip the release. Current
  plan: patch, so every push has a version, with dispatch available to force a
  larger one.
- Whether to also publish an arm64-only APK later for size.
