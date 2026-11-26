import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { patchServiceSource } = require('../plugins/with-notification-progress.js');

const source = readFileSync(
  new URL(
    '../node_modules/expo-audio/android/src/main/java/expo/modules/audio/service/AudioControlsService.kt',
    import.meta.url,
  ),
  'utf8',
);

test('notification progress patch adds a determinate bar and a ticker', () => {
  const patched = patchServiceSource(source);
  assert.match(patched, /KROTIFY_NOTIFICATION_PROGRESS/);
  assert.match(patched, /builder\.setProgress\(1000/);
  assert.match(patched, /progressJob = scope\.launch/);
  assert.match(patched, /import kotlinx\.coroutines\.delay/);
  assert.match(patched, /withContext\(Dispatchers\.Main\) \{ playable\.player\.isPlaying \}/);
  assert.doesNotMatch(patched, /currentPlayable\?\.player\?\.isPlaying/);
});

test('notification progress patch is idempotent', () => {
  const once = patchServiceSource(source);
  assert.equal(patchServiceSource(once), once);
});
