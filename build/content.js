// Lê o conteúdo editável do site (content/*.yaml e content/privacidade.md), confere cada arquivo contra o
// seu JSON Schema (content/schemas/) e devolve, em português, tudo o que estiver errado: arquivo, linha,
// campo e o problema. Roda só no build (nada daqui vai para o navegador). As regras que dependem do
// modo (demo × production: dados reais, CNPJ, autorizações) ficam em build/validate.js.
import Ajv2020 from 'ajv/dist/2020.js';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LineCounter, isMap, parseDocument } from 'yaml';
import { VAR_NAMES } from '../site.config.js';
import { policyProblems } from './privacidade.js';
import { textProblem, textVariables } from './texto.js';

/** Os arquivos YAML de content/ (cada um tem content/schemas/<nome>.schema.json). */
export const CONTENT_FILES = [
  'empresa',
  'site',
  'historia',
  'confianca',
  'produtos',
  'diferenciais',
  'clientes',
  'provas',
  'orcamento',
  'whatsapp',
  'rodape',
];
/** Arquivos com os dados fictícios de referência (o modo production recusa o que sobrar igual a eles). */
export const EXAMPLE_FILES = ['empresa'];

const LONG_DASH = /[–—]/;

/** `/clientes/1/logo` vira `clientes[1].logo`. */
const prettyPath = (path) =>
  path.reduce(
    (text, part) =>
      typeof part === 'number' ? `${text}[${part}]` : `${text ? `${text}.` : ''}${part}`,
    '',
  );

const pointerToPath = (pointer) =>
  pointer
    .split('/')
    .slice(1)
    .map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'))
    .map((part) => (/^\d+$/.test(part) ? Number(part) : part));

/** Distância de edição entre duas palavras (para sugerir o campo certo quando há erro de digitação). */
function distance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const saved = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = saved;
    }
  }
  return row[b.length];
}

const TYPE_NAMES = {
  string: 'um texto (entre aspas)',
  integer: 'um número inteiro',
  number: 'um número',
  boolean: 'true ou false',
  array: 'uma lista (cada item começa com "- ")',
  object: 'um bloco de campos (um por linha, com recuo)',
  null: 'vazio',
};

/** A frase em português para um erro do Ajv (que vem em inglês). */
function describe(error) {
  const { keyword, params, parentSchema: schema, data } = error;
  switch (keyword) {
    case 'required':
      return `falta o campo "${params.missingProperty}"`;
    case 'additionalProperties': {
      const wrong = params.additionalProperty;
      const known = Object.keys(schema.properties ?? {});
      const near = known.filter((name) => distance(wrong, name) <= 2).sort()[0];
      return `o campo "${wrong}" não existe${near ? ` (você quis dizer "${near}"?)` : `; os campos são: ${known.join(', ')}`}`;
    }
    case 'type': {
      const expected = [params.type]
        .flat()
        .map((type) => TYPE_NAMES[type] ?? type)
        .join(' ou ');
      const asNumber = typeof data === 'number' && [params.type].flat().includes('string');
      return `precisa ser ${expected}${asNumber ? `; o valor ${data} foi lido como número, ponha-o entre aspas` : ''}`;
    }
    case 'minLength':
      return params.limit === 1
        ? 'não pode ficar vazio'
        : `precisa ter pelo menos ${params.limit} caracteres`;
    case 'maxLength':
      return `tem ${[...data].length} caracteres; o máximo é ${params.limit} (um texto maior quebraria o layout)`;
    case 'minItems':
      return `precisa ter pelo menos ${params.limit} item(ns)`;
    case 'maxItems':
      return `tem ${data.length} itens; o máximo é ${params.limit}`;
    case 'minimum':
      return `precisa ser ${params.limit} ou mais`;
    case 'maximum':
      return `precisa ser no máximo ${params.limit}`;
    case 'enum':
      return `valor não aceito; use um destes: ${params.allowedValues.join(', ')}`;
    case 'pattern':
      return schema.dica ?? `formato inválido (${data})`;
    default:
      return error.message;
  }
}

/**
 * Linha (a partir de 1) do campo no arquivo, para o erro apontar onde está.
 * @param {import('yaml').Document} doc
 * @param {import('yaml').LineCounter} counter
 * @param {(string | number)[]} path
 * @param {string} [key]
 */
function lineOf(doc, counter, path, key) {
  /** @type {any} */
  let node = path.length ? doc.getIn(path, true) : doc.contents;
  if (key !== undefined && isMap(node)) {
    const pair = /** @type {any[]} */ (node.items).find((item) => String(item.key?.value) === key);
    if (pair?.key?.range) return counter.linePos(pair.key.range[0]).line;
  }
  // o campo não existe (falta): aponta o bloco que devia tê-lo; o caminho inteiro se perdeu: o começo
  for (let i = path.length; !node?.range && i > 0; i--)
    node = doc.getIn(path.slice(0, i - 1), true);
  node ??= doc.contents;
  return node?.range ? counter.linePos(node.range[0]).line : 1;
}

/** Todas as strings de um valor, com o caminho de cada uma. */
function* strings(value, path = []) {
  if (typeof value === 'string') yield [path, value];
  else if (Array.isArray(value))
    for (const [i, item] of value.entries()) yield* strings(item, [...path, i]);
  else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) yield* strings(item, [...path, key]);
  }
}

/**
 * Confere cada texto: sem travessão longo, com a sintaxe de {{ }} certa e só com variáveis que existem.
 * @param {string} label
 * @param {unknown} value
 * @param {(path: (string | number)[]) => string} [locate] a linha do texto, para a mensagem
 * @returns {string[]} um problema por texto, já com o lugar
 */
export function checkTexts(label, value, locate = () => '') {
  const problems = [];
  for (const [path, text] of strings(value)) {
    const where = `${label}${locate(path)} › ${prettyPath(path)}`;
    if (LONG_DASH.test(text)) {
      problems.push(
        `${where}: tem travessão longo (— ou –); use dois-pontos, vírgula, ponto ou hífen`,
      );
    }
    const problem = textProblem(text);
    if (problem) {
      problems.push(`${where}: ${problem}`);
      continue;
    }
    for (const name of textVariables(text)) {
      if (!VAR_NAMES.includes(name)) {
        problems.push(`${where}: a variável {{${name}}} não existe; use: ${VAR_NAMES.join(', ')}`);
      }
    }
  }
  return problems;
}

const YAML_HINTS = {
  DUPLICATE_KEY: 'o mesmo campo aparece duas vezes',
  BAD_INDENT: 'recuo errado (use espaços, sempre o mesmo número de espaços em cada nível)',
  MISSING_CHAR: 'falta fechar aspas, colchete ou chave',
  BAD_SCALAR_START: 'o texto começa com um caractere reservado; ponha-o entre aspas',
  TAB_AS_INDENT: 'o recuo usa Tab; use espaços',
};

/** Os erros do YAML (aspas faltando, recuo errado, campo repetido) em português. */
function yamlProblems(label, doc) {
  return doc.errors.map((error) => {
    const { line, col } = error.linePos?.[0] ?? { line: 1, col: 1 };
    const hint =
      YAML_HINTS[error.code] ??
      `${error.message.split(' at line')[0]} (textos com ":" no meio, ou que começam com { [ * & ! % ou @, precisam de aspas)`;
    return `${label}, linha ${line}, coluna ${col}: erro de formatação do YAML: ${hint}`;
  });
}

/**
 * Lê e valida o conteúdo.
 * @param {string} dir pasta do conteúdo (a content/ do projeto, ou uma cópia nos testes)
 * @returns {{ content: Record<string, any>, errors: string[] }} `content.exemplo` leva os dados fictícios
 */
export function readContent(dir) {
  const errors = [];
  const content = { exemplo: {} };
  const ajv = new Ajv2020({ allErrors: true, strict: true, verbose: true, allowUnionTypes: true });
  ajv.addKeyword({ keyword: 'dica', schemaType: 'string' });

  /** content/privacidade.md: o texto da política (Markdown mínimo, ver build/privacidade.js). */
  const readPolicy = () => {
    const file = join(dir, 'privacidade.md');
    if (!existsSync(file)) {
      errors.push('content/privacidade.md: o arquivo não existe');
      return undefined;
    }
    const markdown = readFileSync(file, 'utf8');
    for (const problem of policyProblems(markdown))
      errors.push(`content/privacidade.md, ${problem}`);
    const problem = textProblem(markdown);
    if (problem) errors.push(`content/privacidade.md: ${problem}`);
    else {
      for (const name of textVariables(markdown)) {
        if (!VAR_NAMES.includes(name)) {
          errors.push(
            `content/privacidade.md: a variável {{${name}}} não existe; use: ${VAR_NAMES.join(', ')}`,
          );
        }
      }
    }
    for (const [i, line] of markdown.split('\n').entries()) {
      if (LONG_DASH.test(line)) {
        errors.push(
          `content/privacidade.md, linha ${i + 1}: tem travessão longo (— ou –); use dois-pontos, vírgula, ponto ou hífen`,
        );
      }
    }
    return markdown;
  };

  const readYaml = (name, folder = '') => {
    const label = `content/${folder}${name}.yaml`;
    const file = join(dir, folder, `${name}.yaml`);
    if (!existsSync(file)) {
      errors.push(`${label}: o arquivo não existe`);
      return undefined;
    }
    const counter = new LineCounter();
    const doc = parseDocument(readFileSync(file, 'utf8'), {
      lineCounter: counter,
      uniqueKeys: true,
    });
    if (doc.errors.length) {
      errors.push(...yamlProblems(label, doc));
      return undefined;
    }
    const schemaFile = join(dir, 'schemas', `${name}.schema.json`);
    const schema = JSON.parse(readFileSync(schemaFile, 'utf8'));
    const validate = ajv.getSchema(schema.$id) ?? ajv.compile(schema);
    const value = doc.toJS();
    const valid = validate(value);
    if (!valid) {
      for (const error of validate.errors ?? []) {
        const path = pointerToPath(error.instancePath);
        const key =
          error.keyword === 'additionalProperties' ? error.params.additionalProperty : undefined;
        const line = lineOf(doc, counter, path, key);
        const field =
          error.keyword === 'required'
            ? [...path, error.params.missingProperty]
            : key
              ? [...path, key]
              : path;
        errors.push(`${label}, linha ${line} › ${prettyPath(field)}: ${describe(error)}`);
      }
    }
    errors.push(...checkTexts(label, value, (path) => `, linha ${lineOf(doc, counter, path)}`));
    return valid ? value : undefined;
  };

  for (const name of CONTENT_FILES) content[name] = readYaml(name);
  content.privacidade = readPolicy();
  for (const name of EXAMPLE_FILES) content.exemplo[name] = readYaml(name, 'exemplo/');
  return { content, errors };
}
