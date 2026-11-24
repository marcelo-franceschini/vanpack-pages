import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { parse } from 'yaml';

export const YAML_MODULES = [
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

function createValidator() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  return ajv;
}

/** Reads and schema-validates all YAML content modules plus `privacidade.md`. */
export function readContent(contentDir) {
  const content = {};
  const errors = [];
  const ajv = createValidator();
  const schemasDir = join(contentDir, 'schemas');

  for (const name of YAML_MODULES) {
    const yamlPath = join(contentDir, `${name}.yaml`);
    if (!existsSync(yamlPath)) {
      errors.push(`Arquivo de conteúdo ausente: ${name}.yaml`);
      continue;
    }

    let parsed;
    try {
      parsed = parse(readFileSync(yamlPath, 'utf8')) ?? {};
    } catch (err) {
      errors.push(`Erro de sintaxe em ${name}.yaml: ${err.message}`);
      continue;
    }

    content[name] = parsed;

    const schemaPath = join(schemasDir, `${name}.schema.json`);
    if (existsSync(schemaPath)) {
      try {
        const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
        const validate = ajv.compile(schema);
        if (!validate(parsed)) {
          for (const issue of validate.errors ?? []) {
            const path = issue.instancePath || '/';
            const hint = issue.parentSchema?.dica ? ` (${issue.parentSchema.dica})` : '';
            errors.push(`${name}.yaml ${path}: ${issue.message}${hint}`);
          }
        }
      } catch (err) {
        errors.push(`Erro ao validar schema ${name}.schema.json: ${err.message}`);
      }
    }
  }

  const privacyPath = join(contentDir, 'privacidade.md');
  if (existsSync(privacyPath)) {
    content.privacidade = readFileSync(privacyPath, 'utf8');
  } else {
    errors.push('Arquivo de conteúdo ausente: privacidade.md');
    content.privacidade = '';
  }

  return { content, errors };
}
