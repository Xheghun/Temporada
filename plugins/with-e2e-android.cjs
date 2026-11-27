const { withAndroidManifest } = require('expo/config-plugins');

module.exports = (config) => {
  if (config.android?.package !== 'com.cremedigital.seasonalworker.e2e')
    throw new Error('e2e_plugin_requires_isolated_package');
  return withAndroidManifest(config, (configuration) => {
    const application = configuration.modResults.manifest.application?.[0];
    if (!application) throw new Error('android_application_missing');
    application.$['android:usesCleartextTraffic'] = 'true';
    return configuration;
  });
};
