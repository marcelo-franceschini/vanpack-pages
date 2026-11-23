import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/', 'dist-*/', '.playwright-cli/', '**/*.ts'] },
  js.configs.recommended,
  {
    files: ['*.config.js', 'tools/**/*.js', 'tools/**/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
