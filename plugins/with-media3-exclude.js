const { withAppBuildGradle } = require('expo/config-plugins');

module.exports = function withMedia3Exclude(config) {
  return withAppBuildGradle(config, (mod) => {
    const marker = 'com.github.MissingCore.media';
    if (!mod.modResults.contents.includes(marker)) {
      mod.modResults.contents +=
        "configurations.all { exclude group: '" + marker + "' }\n";
    }
    return mod;
  });
};
