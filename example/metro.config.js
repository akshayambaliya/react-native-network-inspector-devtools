const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Watch the parent library directory so local file:.. dependency resolves
config.watchFolders = [workspaceRoot];

// Resolve modules from example's node_modules first, then root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Force react and react-native to always resolve from the example's node_modules.
// extraNodeModules alone is not enough for symlinked packages, so we also use
// resolveRequest which intercepts every module resolution unconditionally.
const reactPath = path.resolve(projectRoot, 'node_modules/react');
const reactNativePath = path.resolve(projectRoot, 'node_modules/react-native');

config.resolver.extraNodeModules = {
  react: reactPath,
  'react-native': reactNativePath,
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react') {
    return { filePath: path.join(reactPath, 'index.js'), type: 'sourceFile' };
  }
  if (moduleName === 'react-native') {
    return { filePath: path.join(reactNativePath, 'index.js'), type: 'sourceFile' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

