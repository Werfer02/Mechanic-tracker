const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
// Two levels up: artifacts/mechanic-tracker → artifacts → workspace root
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Let Metro watch and resolve packages from the monorepo root.
// Without this, workspace packages (e.g. @workspace/api-client-react)
// that live in the root node_modules are invisible to Metro.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Exclude native _tmp_ extraction directories that expo packages unpack
// at install time but don't always create fully — Metro's watcher crashes
// trying to watch non-existent android/ios subdirectories inside them.
config.resolver.blockList = [
  /node_modules\/.*_tmp_\d+\/.*/,
  // Exclude agent/skill temp directories that may be created and deleted mid-run
  /\.local\/skills\/\.tmp-.*/,
];

module.exports = config;
