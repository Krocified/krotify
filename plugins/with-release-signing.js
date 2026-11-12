const { withAppBuildGradle } = require('expo/config-plugins');

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    if (!process.env.ANDROID_KEYSTORE_PATH) return mod;
    let contents = mod.modResults.contents;
    if (!contents.includes('signingConfigs.release')) {
      contents = contents.replace(
        'signingConfigs {',
        `signingConfigs {
        release {
            storeFile file(System.getenv("ANDROID_KEYSTORE_PATH"))
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }`,
      );
      contents = contents.replace(
        /(release\s*\{[^}]*?signingConfig\s+)signingConfigs\.debug/s,
        '$1signingConfigs.release',
      );
    }
    mod.modResults.contents = contents;
    return mod;
  });
};
