const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const RESOURCE_NAME = 'media3_icon_circular_play.xml';

const NOTE_GLYPH = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <path
        android:fillColor="#FFFFFFFF"
        android:pathData="M9,17.5a2.75,2.75 0,1 0,2.75 2.75V8.2l7,-1.55v8.35a2.75,2.75 0,1 0,1.5 2.45V4.5L9,6.75z" />
</vector>
`;

module.exports = function withNotificationIcon(config) {
  return withDangerousMod(config, [
    'android',
    async (mod) => {
      const drawableDir = path.join(
        mod.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'drawable',
      );
      await fs.promises.mkdir(drawableDir, { recursive: true });
      await fs.promises.writeFile(path.join(drawableDir, RESOURCE_NAME), NOTE_GLYPH, 'utf8');
      return mod;
    },
  ]);
};
