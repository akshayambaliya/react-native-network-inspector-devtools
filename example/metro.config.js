const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

// Force all workspace code to resolve React/RN from the example app.
// Without this, Metro can walk up into the library workspace and pick the
// library's devDependencies, which produces duplicate React instances and
// invalid hook call errors.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;
config.resolver.extraNodeModules = {
  react: path.resolve(projectRoot, 'node_modules/react'),
  'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
};

// Alias the dev package to local lib/ so in-development changes are picked up.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native-network-inspector-devtools') {
    return {
      filePath: path.resolve(workspaceRoot, 'lib/commonjs/index.js'),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
