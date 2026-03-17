// Metro bundler configuration for Expo Router.
// Enables web support for WASM (required by expo-sqlite on web via OPFS).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Allow .wasm files for SQLite web worker
config.resolver.assetExts.push('wasm');

module.exports = config;
