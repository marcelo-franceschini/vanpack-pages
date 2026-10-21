// Tipos por JSDoc (tsc --checkJs) em build/, site.config.js e src/ (os dois jsconfig*.json). O tsc segue os
// imports: ao checar src/main.js e o 3D dos produtos ele entra em src/scene/ e src/render/, que são
// travados por hash (tests/trava-3d.test.mjs) e têm erros de tipo que ninguém pode corrigir sem mexer no
// que está travado. Esses erros, e só eles, não contam: o resto de src/ é checado por inteiro.
// Sai com erro se sobrar qualquer outro erro de tipo (ou se o tsc falhar sem dizer um erro).
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const PASTAS_TRAVADAS = ['src/scene/', 'src/render/'];
const CONFIGS = ['jsconfig.json', 'jsconfig.pagina.json'];

/**
 * Agrupa a saída do tsc por erro: a linha `arquivo(linha,coluna): error TSxxxx: ...` e as linhas
 * recuadas que continuam a mensagem.
 * @param {string} output
 * @returns {{ file: string, lines: string[] }[]}
 */
export function errosDoTsc(output) {
  const errors = [];
  for (const line of output.split('\n')) {
    const start = /^(\S.*?)\(\d+,\d+\): error TS\d+:/.exec(line);
    if (start) errors.push({ file: start[1], lines: [line] });
    else if (/^\s/.test(line) && errors.length) errors.at(-1).lines.push(line);
  }
  return errors;
}

/** Os erros que contam e os que ficam de fora (arquivos de pastas travadas). */
export function separarTravados(errors) {
  const locked = (error) => PASTAS_TRAVADAS.some((dir) => error.file.startsWith(dir));
  return { contam: errors.filter((e) => !locked(e)), ignorados: errors.filter(locked) };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const root = new URL('..', import.meta.url).pathname;
  const tsc = `${root}node_modules/.bin/tsc`;
  let failed = false;
  let ignored = 0;
  for (const config of CONFIGS) {
    const run = spawnSync(tsc, ['-p', `${root}${config}`], { cwd: root, encoding: 'utf8' });
    const output = `${run.stdout}${run.stderr}`;
    const { contam, ignorados } = separarTravados(errosDoTsc(output));
    ignored += ignorados.length;
    for (const error of contam) console.error(error.lines.join('\n'));
    if (contam.length || (run.status !== 0 && !ignorados.length)) {
      failed = true;
      if (!contam.length) console.error(output);
    }
  }
  if (ignored) {
    console.log(
      `${ignored} erro(s) de tipo em ${PASTAS_TRAVADAS.join(' e ')} (travados por hash) não contam.`,
    );
  }
  process.exit(failed ? 1 : 0);
}
