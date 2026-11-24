import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/', 'dist-*/', '.playwright-cli/', '**/*.ts'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.worker, __SITE__: 'readonly' },
    },
  },
  {
    files: [
      '*.config.js',
      'tools/**/*.js',
      'tools/**/*.mjs',
      'build/**/*.js',
      'scripts/**/*.mjs',
      'tests/**/*.mjs',
    ],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
