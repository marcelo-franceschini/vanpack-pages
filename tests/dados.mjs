// Dados dos testes. O conteúdo de verdade (content/) é a base de tudo; os testes trocam só os dados da
// empresa (ou o que o teste exercita) por cima dele, para não depender de nenhuma cópia dos textos.
// Os dados "reais" abaixo são só para o modo production dos testes: tudo diferente do exemplo (menos o
// que já é real por natureza, como cidade, UF e ano de fundação).
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse, stringify } from 'yaml';
import { readContent } from '../build/content.js';
import { parseEnv } from '../build/env.js';
import { createSiteConfig } from '../site.config.js';

export const ROOT = new URL('..', import.meta.url).pathname;

/** O conteúdo lido de uma pasta; lança com todos os erros se houver algum. */
export function loadContent(dir = `${ROOT}content`) {
  const { content, errors } = readContent(dir);
  if (errors.length) throw new Error(`conteúdo inválido:\n- ${errors.join('\n- ')}`);
  return content;
}

/** O conteúdo de verdade (hoje, os dados fictícios de demonstração). */
export const baseContent = loadContent();

/** O ambiente de exemplo (.env.example): modo demo, URL do site e nenhuma medição. */
export const exampleEnv = parseEnv(readFileSync(`${ROOT}.env.example`, 'utf8'));

/** Dados "reais" de teste para a empresa: nada igual ao exemplo, salvo cidade, UF e ano de fundação. */
export const realEmpresa = {
  razao_social: 'Vanpack Embalagens LTDA',
  cnpj: '11.222.333/0001-81',
  whatsapp: '5511987654321',
  telefone: '+551147001234',
  telefone_exibicao: '(11) 4700-1234',
  endereco: {
    rua: 'Av. das Caixas, 500',
    bairro: 'Distrito Industrial',
    cidade: baseContent.empresa.endereco.cidade,
    uf: baseContent.empresa.endereco.uf,
    cep: '09000-100',
  },
  horario: 'Seg a Sex, 7h30 às 17h30',
  horario_schema: 'Mo-Fr 07:30-17:30',
  mapa: 'https://maps.google.com/?q=Av+das+Caixas+500',
  ano_fundacao: baseContent.empresa.ano_fundacao,
  pedido_minimo: 300,
  regiao: 'Grande São Paulo',
  pagamento: 'Pix e boleto',
};

/** O conteúdo de verdade com outros dados da empresa (e, se quiser, outros arquivos por cima). */
export const withEmpresa = (empresa, extra = {}) => ({ ...baseContent, empresa, ...extra });

/** O conteúdo em production: dados reais e sem os clientes de exemplo (os testes acrescentam o que precisam). */
export const realContent = (extra = {}) =>
  withEmpresa(realEmpresa, { clientes: { clientes: [] }, ...extra });

/** A config do site com o que o teste quiser trocar: `env`, `content` (padrão: o de verdade) e `now`. */
export const siteWith = ({ env = exampleEnv, content = baseContent, now, experiments } = {}) =>
  createSiteConfig({ env, content, now, experiments });

/** Uma config sem nenhum dado da empresa, só com o WhatsApp (o render recusa wa.me sem número). */
export const emptySite = (whatsapp = '5511912345678') =>
  siteWith({ env: {}, content: withEmpresa({ whatsapp }) });

/**
 * Uma cópia de content/ numa pasta temporária, com arquivos trocados: `files` mapeia o caminho (ex.:
 * 'empresa.yaml') para o objeto que vira YAML. Devolve a pasta e como apagá-la. Os builds dos testes a
 * usam pela variável VANPACK_CONTENT.
 */
export function contentCopy(files = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'vanpack-content-'));
  cpSync(`${ROOT}content`, dir, { recursive: true });
  for (const [path, value] of Object.entries(files)) {
    writeFileSync(join(dir, path), typeof value === 'string' ? value : stringify(value));
  }
  return { dir, remove: () => rmSync(dir, { recursive: true, force: true }) };
}

/** Lê um arquivo YAML do content/ de verdade como objeto (para trocar um campo numa cópia). */
export const readYaml = (path) => parse(readFileSync(`${ROOT}content/${path}`, 'utf8'));
