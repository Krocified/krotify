const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = 'KROTIFY_NOTIFICATION_PROGRESS';
const SERVICE_PATH = [
  'node_modules',
  'expo-audio',
  'android',
  'src',
  'main',
  'java',
  'expo',
  'modules',
  'audio',
  'service',
  'AudioControlsService.kt',
];

const PROGRESS_BLOCK = `    // ${MARKER}: show elapsed time as a determinate notification progress bar.
    run {
      val progressPlayer = session.player
      val progressDuration = progressPlayer.duration
      if (progressDuration > 0L) {
        val progress = ((progressPlayer.currentPosition.toDouble() / progressDuration) * 1000).toInt()
        builder.setProgress(1000, progress.coerceIn(0, 1000), false)
      }
    }
`;

const TICKER_BLOCK = `    // ${MARKER}: notification progress only changes while playback advances.
    progressJob = scope.launch {
      while (isActive) {
        delay(1000L)
        val playable = currentPlayable ?: continue
        // ExoPlayer state must be read on its application looper (main). This ticker runs on
        // Dispatchers.IO, so reading isPlaying directly here crashes the process.
        val isPlaying = withContext(Dispatchers.Main) { playable.player.isPlaying }
        if (isPlaying) {
          postOrStartForegroundNotification(startInForeground = false)
        }
      }
    }
`;

function replaceOnce(source, anchor, replacement, label) {
  const index = source.indexOf(anchor);
  if (index === -1) {
    throw new Error(`with-notification-progress: could not find ${label}`);
  }
  if (source.indexOf(anchor, index + anchor.length) !== -1) {
    throw new Error(`with-notification-progress: ${label} is not unique`);
  }
  return source.slice(0, index) + replacement + source.slice(index + anchor.length);
}

function patchServiceSource(source) {
  if (source.includes(MARKER)) return source;

  let next = replaceOnce(
    source,
    'import kotlinx.coroutines.cancel\n',
    'import kotlinx.coroutines.cancel\nimport kotlinx.coroutines.delay\nimport kotlinx.coroutines.withContext\n',
    'the coroutine imports',
  );
  next = replaceOnce(
    next,
    '  private var artworkLoadJob: Job? = null\n',
    '  private var artworkLoadJob: Job? = null\n  private var progressJob: Job? = null\n',
    'the artwork job field',
  );
  next = replaceOnce(
    next,
    '    createNotificationChannelIfNeeded()\n  }\n',
    `    createNotificationChannelIfNeeded()\n${TICKER_BLOCK}  }\n`,
    'the service onCreate body',
  );
  next = replaceOnce(
    next,
    '    val style = MediaStyleNotificationHelper.MediaStyle(session)\n',
    `${PROGRESS_BLOCK}    val style = MediaStyleNotificationHelper.MediaStyle(session)\n`,
    'the notification builder',
  );
  next = replaceOnce(
    next,
    '    scope.cancel()\n',
    '    progressJob?.cancel()\n    scope.cancel()\n',
    'the service onDestroy body',
  );
  return next;
}

function patchExpoAudio(projectRoot) {
  const file = path.join(projectRoot, ...SERVICE_PATH);
  if (!fs.existsSync(file)) return;
  const source = fs.readFileSync(file, 'utf8');
  const next = patchServiceSource(source);
  if (next !== source) fs.writeFileSync(file, next, 'utf8');
}

module.exports = function withNotificationProgress(config) {
  return withDangerousMod(config, [
    'android',
    async (mod) => {
      patchExpoAudio(mod.modRequest.projectRoot);
      return mod;
    },
  ]);
};

module.exports.patchServiceSource = patchServiceSource;
