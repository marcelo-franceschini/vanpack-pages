// Executa a geração de marcas da Vanpack e sincroniza os SVGs e src/brand/marks.js.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pyScript = join(__dirname, 'brand.py');

console.log('Executando geração de marcas e tipografia com uv...');
execFileSync(
  'uv',
  ['run', '--with', 'fonttools[ufo,woff]', '--with', 'uharfbuzz', 'python3', pyScript],
  {
    stdio: 'inherit',
  },
);
console.log('Marcas geradas com sucesso.');
