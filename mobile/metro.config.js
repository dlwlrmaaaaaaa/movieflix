const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);
const repositoryRoot = path.resolve(__dirname, '..');
const sharedRoot = path.join(repositoryRoot, 'shared');

// SDK 51 needs explicit visibility of file:../shared on EAS/Linux. Resolve its
// React Native source entry so mobile bundles do not depend on generated dist.
config.watchFolders = [...new Set([...(config.watchFolders || []), sharedRoot])];
config.resolver.nodeModulesPaths = [
  path.join(__dirname, 'node_modules'),
  path.join(repositoryRoot, 'node_modules'),
];
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  '@togetherflix/shared': sharedRoot,
};
config.resolver.resolverMainFields = [
  'react-native',
  ...config.resolver.resolverMainFields.filter((field) => field !== 'react-native'),
];

// Expo SDK 51's Metro resolver predates full support for packages that expose
// separate ESM and CommonJS entries. Use LiveKit's CommonJS entry instead.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
