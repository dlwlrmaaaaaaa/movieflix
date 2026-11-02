const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Expo SDK 51's Metro resolver predates full support for packages that expose
// separate ESM and CommonJS entries. Use LiveKit's CommonJS entry instead.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
