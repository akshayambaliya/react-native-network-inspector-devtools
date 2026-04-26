const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const packageRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Watch the local package source so Metro picks up live changes
config.watchFolders = [packageRoot];

// Resolve packages only from the app's node_modules.
// This avoids duplicate React/React Native instances when the local package
// (file:../) also has its own node_modules folder.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

// Force singular copies of React to prevent duplicate-React hook errors
config.resolver.extraNodeModules = {
  react: path.resolve(projectRoot, 'node_modules/react'),
  'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
};

module.exports = config;

