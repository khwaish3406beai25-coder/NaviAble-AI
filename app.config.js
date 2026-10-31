const path = require('node:path');
const { loadEnvFiles } = require('@expo/env');

// This workspace stores its shared .env one level above the Expo app folder.
// Expo's Metro env inlining only reads files from the app root, so expose these
// values through Expo runtime config instead of relying on process.env in JS.
// Expo's CLI may mark its own app-root dotenv pass as already loaded before
// evaluating this config. Force parsing the workspace file; existing shell
// variables still take precedence over dotenv values.
loadEnvFiles([path.resolve(__dirname, '../.env')], { silent: true, force: true });

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    naviable: {
      ...config.extra?.naviable,
      geminiApiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY || '',
      yoloUrl: process.env.EXPO_PUBLIC_YOLO_URL || '',
    },
  },
});
