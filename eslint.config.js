import js from '@eslint/js';
import globals from 'globals';

export default [
  // dist-audit/ é o build de auditoria (npm run build:audit); os demais dist-*/ são builds de teste.
  { ignores: ['dist/', 'dist-*/'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: { globals: { ...globals.browser, ...globals.worker } },
  },
  {
    files: ['*.config.js', 'build/**/*.js'],
    languageOptions: { globals: globals.node },
  },
  {
    // Scripts e testes: rodam no Node e passam funções para o navegador (page.evaluate).
    files: ['scripts/**/*.mjs', 'tests/**/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];
