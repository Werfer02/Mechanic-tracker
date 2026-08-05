const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

/**
 * Make the local HTTP API reachable from standalone Android builds.
 *
 * `usesCleartextTraffic` is not sufficient on every generated Android
 * manifest, so install an explicit Network Security Config and reference it
 * from the application element.
 */
module.exports = function withCleartextNetwork(config) {
  config = withAndroidManifest(config, config => {
    const application = config.modResults.manifest.application?.[0];
    if (!application) {
      throw new Error('Android application manifest entry was not found');
    }

    application.$ = application.$ || {};
    application.$['android:networkSecurityConfig'] =
      '@xml/network_security_config';
    application.$['android:usesCleartextTraffic'] = 'true';
    return config;
  });

  return withDangerousMod(config, [
    'android',
    async config => {
      const source = path.join(
        config.modRequest.projectRoot,
        'network_security_config.xml',
      );
      const resourcesDir = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'xml',
      );
      fs.mkdirSync(resourcesDir, { recursive: true });
      fs.copyFileSync(
        source,
        path.join(resourcesDir, 'network_security_config.xml'),
      );
      return config;
    },
  ]);
};