import js from '@eslint/js';
import globals from 'globals';

export default [
  // 'Vanpack Site v4/' é o pacote do Claude Design (fora do git); dist-audit/ é o build de auditoria.
  { ignores: ['dist/', 'dist-audit/', 'Vanpack Site v4/'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: { globals: { ...globals.browser, ...globals.worker } },
  },
  {
    files: ['*.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    // Scripts e testes: rodam no Node e passam funções para o navegador (page.evaluate).
    files: ['scripts/**/*.mjs', 'tests/**/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];
