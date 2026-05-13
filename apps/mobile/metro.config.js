const fs = require('fs');
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.disableHierarchicalLookup = true;
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Nested / hoisted quirks with disableHierarchicalLookup: map packages Metro must see.
const reactNativeDir = path.dirname(
  require.resolve('react-native/package.json', {
    paths: [projectRoot, workspaceRoot],
  }),
);
const virtualizedLists = path.join(
  reactNativeDir,
  'node_modules',
  '@react-native',
  'virtualized-lists',
);
const reanimatedDir = path.dirname(
  require.resolve('react-native-reanimated/package.json', {
    paths: [projectRoot, workspaceRoot],
  }),
);
/** Reanimated needs semver ^7 (`semver/functions/*`); npm may hoist semver@6 at repo root. */
function resolveSemverForMetro() {
  const nested = path.join(reanimatedDir, 'node_modules', 'semver');
  if (fs.existsSync(path.join(nested, 'functions', 'satisfies.js'))) {
    return nested;
  }
  const rootPkg = path.join(workspaceRoot, 'node_modules', 'semver', 'package.json');
  if (fs.existsSync(rootPkg)) {
    const { version } = JSON.parse(fs.readFileSync(rootPkg, 'utf8'));
    if (String(version).startsWith('7.')) return path.dirname(rootPkg);
  }
  throw new Error(
    '[metro] semver v7+ with functions/satisfies not found (expected under react-native-reanimated)',
  );
}
const semverForMetro = resolveSemverForMetro();

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  '@react-native/virtualized-lists': virtualizedLists,
  semver: semverForMetro,
};

module.exports = config;
