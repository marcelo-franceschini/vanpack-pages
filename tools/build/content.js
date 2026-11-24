import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020Mod from 'ajv/dist/2020.js';
import { parse as parseYaml } from 'yaml';

const Ajv2020 = Ajv2020Mod.default ?? Ajv2020Mod;

export const CONTENT_FILES = [
  'site',
  'empresa',
  'historia',
  'produtos',
  'diferenciais',
  'clientes',
  'provas',
  'orcamento',
  'rodape',
  'whatsapp',
];

function formatAjvError(name, err) {
  const loc = err.instancePath ? `${name}.yaml${err.instancePath}` : `${name}.yaml`;
  return `${loc}: ${err.message ?? 'valor inválido'}`;
}

/**
 * Loads all YAML files and `privacidade.md` from `contentDir` and validates each YAML document
 * against its JSON Schema (Draft 2020-12). Uses a fresh Ajv instance per invocation so hot-reloads
 * in Vite dev mode never collide on duplicate `$id` registrations.
 */
export function readContent(contentDir) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const content = {};
  const errors = [];

  for (const name of CONTENT_FILES) {
    const yamlPath = join(contentDir, `${name}.yaml`);
    const schemaPath = join(contentDir, 'schemas', `${name}.schema.json`);

    if (!existsSync(yamlPath)) {
      errors.push(`Arquivo ausente: content/${name}.yaml`);
      continue;
    }

    let data;
    try {
      data = parseYaml(readFileSync(yamlPath, 'utf8'));
    } catch (err) {
      errors.push(`Erro de sintaxe em content/${name}.yaml: ${err.message}`);
      continue;
    }

    if (existsSync(schemaPath)) {
      const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
      const validate = ajv.compile(schema);
      if (!validate(data)) {
        for (const issue of validate.errors ?? []) {
          errors.push(formatAjvError(name, issue));
        }
      }
    }

    content[name] = data;
  }

  const privacyPath = join(contentDir, 'privacidade.md');
  if (existsSync(privacyPath)) {
    content.privacidade = readFileSync(privacyPath, 'utf8');
  } else {
    errors.push('Arquivo ausente: content/privacidade.md');
    content.privacidade = '';
  }

  return { content, errors };
}
