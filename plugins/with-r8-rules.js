const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const RULES = `
# jaudiotagger references desktop image APIs that do not exist on Android.
-dontwarn java.awt.**
-dontwarn javax.imageio.**
-dontwarn org.jaudiotagger.**
-keep class org.jaudiotagger.** { *; }
`;

module.exports = function withR8Rules(config) {
  return withDangerousMod(config, [
    'android',
    async (mod) => {
      const file = path.join(
        mod.modRequest.platformProjectRoot,
        'app',
        'proguard-rules.pro',
      );
      const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      if (!existing.includes('-dontwarn java.awt.**')) {
        fs.appendFileSync(file, RULES);
      }
      return mod;
    },
  ]);
};
