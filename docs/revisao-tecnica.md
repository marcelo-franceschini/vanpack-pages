# Revisão técnica e plano de evolução

Registro consolidado da revisão técnica realizada no repositório da página institucional da **Vanpack Embalagens**, incluindo os problemas identificados com evidência, as melhorias incrementais implementadas, as medições antes e depois, os trade-offs adotados e as propostas estruturais que dependem de aprovação prévia.

## 1. Problemas identificados

### 1.1 Build, empacotamento e desempenho de rede

1. **Triplicação do Three.js no bundle de produção**: `tools/build/shared-three.js` estava reduzido a um stub vazio (`{ plugins: [], workerPlugins: () => [] }`). Com isso, o Vite empacotava três cópias independentes do Three.js (`worker-*.js`, `produtos-worker-*.js` e `controller-*.js`), totalizando ~1,65 MB brutos (~425 KB gzip) em `dist/assets/*.js`.
2. **Caminhos quebrados no CSS inlineado**: o plugin `inlineCssAndCspPlugin` embutia o CSS compilado diretamente nos arquivos HTML da raiz, mas mantinha caminhos relativos `url(../fonts/archivo-latin.woff2)` e `url(../brand/vanpack-simbolo.svg)` gerados para `assets/*.css`. Em subcaminhos, esses recursos falhavam com HTTP 404.
3. **Resolução de `%VITE_SITE_URL%`, indexação em modo `demo` e `404.html` em subcaminho**:
   - Quando `VITE_SITE_URL` não estava definido, o literal `%VITE_SITE_URL%` vazava para `canonical`, `og:url` e `og:image` em `dist/index.html`.
   - Em modo `demo`, o site emitia `robots.txt` com `Allow: /` e não incluía `<meta name="robots" content="noindex,nofollow" />`, expondo dados fictícios à indexação.
   - `404.html` não recebia `<base href="..." />` quando publicado em subcaminho (por exemplo, GitHub Pages).
4. **Composição WebGL com `backdrop-filter: blur(12px)` no cabeçalho fixo**: o desfoque sobre o `<canvas>` WebGL em tela cheia causava retrabalho de composição por quadro durante a rolagem.

### 1.2 Layout, acessibilidade (WCAG) e conformidade HTML

5. **Cinco erros no `html-validate` sobre o HTML de produção**:
   - `<form id="quick-quote">` sem botão de submissão nativo (`wcag/h32`).
   - `<div class="fab" aria-label="Contato rápido">` com `aria-label` em elemento genérico sem papel semântico (`aria-label-misuse`).
   - `<div class="carrossel-janela" role="region">` em vez de elemento nativo `<section>` (`prefer-native-element`).
   - Espaços em branco ao final de linhas geradas após remoção de blocos condicionais (`no-trailing-whitespace`, 2 ocorrências).
6. **Barra flutuante móvel (`.fab`) obstruindo o 1º capítulo do Hero e desalinhada com `src/story.js`**:
   - `src/story.js` controlava a barra até `768px` (`BAR = '(max-width: 768px)'`) via classe `.on`, mas `src/styles/sections.css` usava `@media (max-width: 44rem)` (`704px`) e exibia `.fab` permanentemente, cobrindo o selo regional (`"Atendemos Santo André, ABC e Grande São Paulo"`) no carregamento inicial em `390×844`.
   - A barra também não se recolhia ao entrar na seção `#orcamento` (onde o CTA principal já está em evidência).
7. **Sobreposição do cabeçalho fixo nas páginas secundárias**: `.page-main` em `src/styles/pages.css` não descontava `var(--hdr-h)` no padding superior, fazendo o `.hdr` fixo sobrepor o `<h1>` em `politica-de-privacidade.html` e `404.html`.
8. **Detalhes de responsividade no Hero**:
   - No mobile (`390×844`), o link secundário `"Ver produtos ↓"` (`.actions .btn-soft`) exibia uma borda cinza indesejada herdada de `.btn-soft`.
   - Em telas estreitas (`320px` a `360px`), `.actions .btn` mantinha `white-space: nowrap`, correndo risco de estouro horizontal.
   - Em notebooks `1280px` a `1366px`, `.card:has(h1)` fixo em `44rem` avançava sobre o alimentador da máquina 3D.
   - No modo retrato, `.card:has(h1)` vencia a especificidade de `.card { width: 100% }`.
9. **Acessibilidade e dica visual na vitrine 3D (`src/produtos/montar.js`)**:
   - O `<canvas>` tinha `role="img"` e `aria-label` duplicando a descrição já presente no contêiner `area` (`role="group"`), causando leitura dupla em leitores de tela.
   - A dica `"Arraste para girar"` (`.model-hint`) nunca desaparecia após interação, pois `data-interacted="true"` não era definido ao arrastar ou usar o teclado.
   - Em caso de falha WebGL (`fail()`), os ouvintes globais de `visibilitychange` e `prefers-reduced-motion` permaneciam registrados.
10. **Fallback sem WebGL no Hero (`src/main.ts`)**: `stage.ready.then(() => stageEl.classList.add('ready'))` ocultava o símbolo da marca mesmo quando `mountStage` resolvia `false` (sem WebGL), deixando o fundo vazio.

### 1.3 Robustez, segurança e higiene editorial

11. **Middleware de logos em desenvolvimento (`vite.config.js`)**: `decodeURIComponent(req.url)` sem `try/catch` podia lançar `URIError` diante de URLs malformadas.
12. **Validação de protocolo em links externos (`tools/build/render.js`)**: links de mapa e avaliação Google agora passam por verificação explícita de protocolo `https://` como defesa em profundidade na camada de renderização.
13. **Handoff do WhatsApp (`src/ui/handoff.ts`)**: cliques com modificadores (`Ctrl`/`Cmd`/botão do meio) disparavam o temporizador do diálogo auxiliar; o tempo de espera de `1100ms` era curto para a abertura do aplicativo em celulares lentos; o diálogo não fechava automaticamente caso a aba fosse para segundo plano após abrir.
14. **Telemetria (`src/telemetry/analytics.ts`)**: `sendUmami` não filtrava navegadores automatizados (`navigator.webdriver`) nem domínios divergentes de `cfg.host`; `trackEvent` descartava eventos quando `window.dataLayer` ainda não havia sido inicializado.
15. **Quebra de endereço no rodapé**: endereço em linha única separada por vírgulas quebrava CEP e cidade/UF de forma desfavorável; agora usa `<br />` entre logradouro, bairro, cidade/UF e CEP.
16. **Padronização editorial (sem travessão)**: removidas ocorrências de travessão (U+2014) em `content/produtos.yaml`, nos `aria-label` da marca nos HTMLs e na mensagem do montador de orçamento (`src/ui/quick-quote.ts` e `tools/build/render.js`).

## 2. Melhorias implementadas e justificativas

| Área                       | Arquivo(s)                                                                                                     | Alteração                                                                                                                                                                                                                                                                                                                                                                                  | Benefício concreto                                                                                                                                                                                   |
| -------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build 3D compartilhado     | `tools/build/shared-three.js`, `vite.config.js`                                                                | Compila um único módulo ES `assets/three-<hash>.js` com tree-shaking, externaliza `three` e `three/addons/*` nos builds principal e de workers (`enforce: 'pre'`) e injeta `<link rel="modulepreload">` em `index.html`.                                                                                                                                                                   | Redução de 61,9% do total de JS em `dist/assets/` (-1,02 MB brutos / -251 KB gzip) e de 44,1% do JS transferido numa visita completa, preservando 100% da fidelidade visual e a trava SHA-256 do 3D. |
| CSS inline & subcaminho    | `vite.config.js`                                                                                               | Reescreve `url(../` para `url(./` ao inlinear CSS e injeta `<base href>` em `404.html` quando há subcaminho em `VITE_SITE_URL`.                                                                                                                                                                                                                                                            | Elimina 404 de fonte e símbolo da marca em qualquer caminho de hospedagem.                                                                                                                           |
| SEO e modo `demo`          | `tools/build/render.js`, `tools/build/files.js`                                                                | Trata `VITE_SITE_URL` vazio sem vazamento de token, injeta `noindex,nofollow` e emite `Disallow: /` em `robots.txt` fora de produção; valida protocolo `https://` em links externos; formata endereço com `<br />`.                                                                                                                                                                        | Impede indexação de dados de demonstração, corrige metadados sociais e evita URLs inseguras.                                                                                                         |
| Validação HTML / WCAG      | `index.html`, `politica-de-privacidade.html`, `404.html`, `tools/build/render.js`, `src/ui/quick-quote.ts`     | Converte `.fab` para `<aside>`, `.carrossel-janela` para `<section>` e `#quick-quote` para `<div role="group">` com suporte à tecla `Enter` nos campos; remove espaços à direita e travessões.                                                                                                                                                                                             | Zera todos os 5 erros do `html-validate` mantendo navegação nativa direta para `wa.me`.                                                                                                              |
| Layout mobile e desktop    | `src/styles/base.css`, `src/styles/hero.css`, `src/styles/sections.css`, `src/styles/pages.css`, `src/main.ts` | Remove `backdrop-filter` do `.hdr`; ajusta largura do card 1 com `min(44rem, calc(var(--t-display) * 13.167 + 4.5rem), 100%)`; sincroniza `.fab` em `48rem` (768px) oculto no capítulo 1 e na seção `#orcamento` (`.away`); reserva espaço da `.fab` nos capítulos 2 a 5 e no rodapé; corrige borda do `.btn-soft`, quebra de texto em botões estreitos e offset superior de `.page-main`. | Elimina sobreposições reais no mobile (`390×844`) e na página de privacidade, melhora fluidez de rolagem sobre WebGL e protege notebooks `1280px` a `1366px`.                                        |
| Vitrine 3D e fallback Hero | `src/produtos/montar.js`, `src/main.ts`                                                                        | Marca `<canvas aria-hidden="true">`, mantém descrição única atualizável em `area`, define `data-interacted="true"` no arrasto/teclado, remove ouvintes globais em `fail()` e exige `ok === true` em `stage.ready`.                                                                                                                                                                         | Corrige leitura dupla em leitores de tela, faz a dica `"Arraste para girar"` sumir após uso e preserva o fallback visual quando WebGL não existe.                                                    |
| Handoff e telemetria       | `src/ui/handoff.ts`, `src/telemetry/analytics.ts`, `vite.config.js`                                            | Ignora cliques modificados, amplia espera para `2500ms`, fecha o modal quando `document.hidden` ativa; bloqueia beacons em `navigator.webdriver` ou host incorreto; inicializa `window.dataLayer`; protege `decodeURIComponent` com `try/catch`.                                                                                                                                           | Menos falsos positivos no diálogo do WhatsApp, métricas limpas e servidor de desenvolvimento resistente a URLs inválidas.                                                                            |
| Testes de regressão        | `tests/build.test.ts`, `tests/quote.test.ts`                                                                   | Novos testes cobrindo chunk único `three-*.js`, `modulepreload`, ausência de `url(../` e `%VITE_SITE_URL%`, `noindex`/`Disallow`, ausência de travessões e rejeição de URLs `javascript:`.                                                                                                                                                                                                 | Garante que nenhuma dessas regressões volte silenciosamente.                                                                                                                                         |

## 3. Métricas e comparações antes e depois

Medições obtidas no mesmo ambiente (Vite 8.3.8, compressão `zlib.gzipSync` nível 9) comparando o estado original com o build final:

| Artefato / Métrica                                                              | Antes                            | Depois                                              | Variação                            |
| ------------------------------------------------------------------------------- | -------------------------------- | --------------------------------------------------- | ----------------------------------- |
| `assets/worker-*.js` (fábrica 3D)                                               | 545,8 KB raw / 139,2 KB gz       | 30,9 KB raw / 12,6 KB gz                            | -94,3% raw / -90,9% gz              |
| `assets/produtos-worker-*.js` (vitrine 3D)                                      | 540,1 KB raw / 137,1 KB gz       | 20,0 KB raw / 8,2 KB gz                             | -96,3% raw / -94,0% gz              |
| `assets/controller-*.js` (fallback inline)                                      | 541,8 KB raw / 139,0 KB gz       | 30,9 KB raw / 12,7 KB gz                            | -94,3% raw / -90,9% gz              |
| `assets/three-*.js` (chunk único compartilhado)                                 | inexistente (duplicado 3x)       | 522,4 KB raw / 130,5 KB gz                          | Carregado 1 vez com `modulepreload` |
| **Total `dist/assets/*.js`**                                                    | **1.652,2 KB raw / 425,3 KB gz** | **629,0 KB raw / 174,1 KB gz**                      | **-61,9% raw / -59,1% gz**          |
| **JS de visita completa (`index + three + worker + montar + produtos-worker`)** | **1.102,3 KB raw / 283,2 KB gz** | **590,2 KB raw / 158,3 KB gz**                      | **-46,5% raw / -44,1% gz**          |
| JS adicional ao rolar até `#produtos`                                           | 544,6 KB raw / 139,1 KB gz       | 24,6 KB raw / 10,2 KB gz                            | -95,5% raw / -92,7% gz              |
| Erros no `html-validate` (`dist/*.html`)                                        | 5 erros                          | 0 erros                                             | -100%                               |
| Sobreposição `.fab` no cap. 1 mobile (`390×844`)                                | Cobria o selo regional           | Oculta no cap. 1; 14px livres no cap. 2             | Corrigido                           |
| Sobreposição `.hdr` em `politica-de-privacidade.html`                           | `.hdr` cobria o `<h1>`           | Sem sobreposição (`padding-top` com `var(--hdr-h)`) | Corrigido                           |
| Trava SHA-256 do 3D (`tests/trava-3d.test.mjs`)                                 | Passando                         | Passando (fidelidade 100% preservada)               | Intacta                             |
| Vulnerabilidades de dependências (`bun audit`)                                  | 0                                | 0                                                   | Nenhuma dependência adicionada      |

## 4. Decisões técnicas e trade-offs

1. **Deduplicação do Three.js em build sem alterar `src/scene/` ou `src/render/`**:
   - **Decisão**: implementar o compartilhamento de módulo ES no plugin de build (`tools/build/shared-three.js`) mantendo intacto todo o código-fonte 3D da fábrica.
   - **Trade-off**: exige varredura estática dos imports nomeados de `three` e `three/addons/*` durante o build (verificada automaticamente por teste em `tests/build.test.ts`), mas preserva 100% da fidelidade visual e mantém `tests/trava-3d.test.mjs` verde sem qualquer risco de regressão na cena 3D.
2. **Troca de `<form id="quick-quote">` para `<div role="group">`**:
   - **Decisão**: manter o botão principal como `<a href="https://wa.me/...">` direto, que evita bloqueio de pop-up no iOS Safari e em WebViews, eliminando o erro `wcag/h32` ao remover o wrapper `<form>` sem submit real.
   - **Trade-off**: a tecla `Enter` nos campos de texto passou a ser tratada explicitamente em `src/ui/quick-quote.ts`, comportamento simples e determinístico.
3. **Remoção de `backdrop-filter: blur(12px)` no `.hdr`**:
   - **Decisão**: usar fundo `rgba(251, 248, 242, 0.97)` no topo e `var(--papel)` sólido ao rolar (`.hdr.solid`).
   - **Trade-off**: perde o leve desfoque translucente no cabeçalho em troca de eliminar leitura de framebuffer WebGL a cada frame durante o scroll. Visualmente, o contraste e a paleta Papel permanecem praticamente idênticos.

## 5. Recomendações descartadas e motivos

- **Adicionar `@typescript-eslint` ou novas dependências de lint/build**: descartado por não trazer ganho proporcional; `tsc --noEmit` com `strict: true`, `noUnusedLocals: true` e `noUnusedParameters: true` já valida todos os arquivos TypeScript sem inchar `package.json`.
- **Reescrever ou modificar materiais, geometrias e shaders de `src/scene/`**: descartado porque a cena já é leve, bem estruturada, protegida por trava SHA-256 (`tests/trava-3d.test.mjs`) e a otimização de rede via chunk compartilhado entregou economia muito maior com risco zero à fidelidade visual.
- **Alterar o modelo de dados YAML ou remover `quick-quote` unilateralmente**: descartado nesta rodada por envolver decisão de produto e cópia legal (documentado abaixo na seção 7).

## 6. Resultados das validações

Todas as validações foram executadas após a última alteração de código:

- **Tipagem (`npm run typecheck`)**: aprovado, 0 erros.
- **Lint e formatação (`npm run lint`: ESLint + Prettier)**: aprovado, 0 erros e 0 avisos.
- **Build de produção (`npm run build`)**: aprovado em ~470ms, gerando `dist/assets/three-*.js` compartilhado e CSP válida em todas as páginas HTML.
- **Suíte unitária e de build (`npm test`)**: 13/13 testes aprovados (`tests/build.test.ts`, `tests/content.test.ts`, `tests/engine.test.ts`, `tests/quote.test.ts`).
- **Trava de fidelidade 3D (`node --test tests/trava-3d.test.mjs`)**: aprovado (hash SHA-256 intacto).
- **Validação HTML (`npx html-validate dist/index.html dist/politica-de-privacidade.html dist/404.html`)**: aprovado, 0 erros (antes: 5 erros).
- **Verificação visual e funcional em Chromium headless sobre o build `dist/` (`vite preview`)**:
  - Desktop `1440×900`: Hero 3D pronto (`stage.ready`), 0 erros de console, 0 erros de CSP, vitrine 3D dos produtos carregando a partir do mesmo `three-*.js` compartilhado, arrasto ativando `data-interacted="true"`, montador de orçamento atualizando prévia e link `wa.me` sem travessão.
  - Mobile `390×844`: sem rolagem horizontal, `.fab` oculta no capítulo 1 com selo regional totalmente visível, `"Ver produtos ↓"` sem borda cinza, `.fab` aparecendo no capítulo 2 com folga de 14px abaixo do cartão, `.fab` ocultando-se ao entrar em `#orcamento` e `politica-de-privacidade.html` sem sobreposição entre `.hdr` e `<h1>`.

## 7. Propostas que dependem de aprovação adicional

Os itens abaixo envolvem decisões de arquitetura, escopo funcional ou copy institucional e **não foram alterados unilateralmente**:

1. **Consolidação do código 3D duplicado (JS ativo vs. TS órfão)**:
   - Hoje o aplicativo executa exclusivamente a pilha JS (`src/render/`, `src/scene/`, `src/produtos/`, `src/story.js`), enquanto `src/engine/`, `src/scenes/` e `src/ui/story.ts` existem no repositório sem serem importados por `src/main.ts` (apenas exercitados por `tests/engine.test.ts`).
   - **Proposta**: decidir entre (a) arquivar/remover a árvore TS órfã para reduzir confusão e custo de manutenção, ou (b) concluir a migração controlada para a pilha TS com auditoria visual quadro a quadro e atualização da trava 3D.
2. **Coerência entre o montador `#quick-quote` e a promessa editorial "sem formulário"**:
   - `content/privacidade.md` e parte da narrativa do site afirmam que o site "não tem formulário", enquanto `#orcamento` exibe o montador inline (`#quick-quote`) com campos de medidas e quantidade (que não envia dados a servidor algum, apenas monta a mensagem local do WhatsApp).
   - **Proposta**: aprovar o ajuste de texto na Política de Privacidade esclarecendo que o montador opcional apenas compõe a mensagem localmente no navegador (sem envio a servidor), ou decidir pela remoção do montador caso a preferência seja manter exclusivamente botões diretos de WhatsApp.
3. **Limpeza ou atualização dos testes legados (`tests/*.test.mjs`) e workflows de CI (`.github/workflows/`)**:
   - Grande parte dos 36 arquivos `tests/*.test.mjs` ainda importa caminhos antigos (`build/csp.js`, `build/render.js`, `build/three-compartilhado.js`) anteriores à migração para `tools/build/`, o que impede sua execução direta, e os workflows de CI precisam ser alinhados aos scripts atuais de `package.json`.
   - **Proposta**: consolidar os testes legados úteis (paridade, acessibilidade com `axe-core`, subcaminho e robustez) nos caminhos atuais de `tools/build/` e remover arquivos obsoletos, sincronizando os workflows de CI/deploy.
4. **Decisão sobre `src/tour.js` (tour automático)**:
   - O módulo `src/tour.js` não está conectado ao `src/main.ts`.
   - **Proposta**: confirmar se o tour automático foi descontinuado definitivamente (para remoção segura) ou se deve retornar como recurso opcional acionado pelo usuário.

## 8. Alinhamento horizontal e ajuste multitelas (Android, iPhone, tablet e paisagem)

Auditoria direta em Chromium headless em 8 resoluções reais (`320×568`, `360×800`, `375×667`, `390×844`, `430×932`, `768×1024`, `844×390` e `1440×900`) revelou quatro problemas concretos de largura horizontal e alinhamento entre seções:

1. **Recorte horizontal real em `#orcamento` em celulares `320px` e `360px`**: as grades responsivas `.models`, `.pillars`, `.cta-grid`, `.ftr-top` e `.qq-grid` usavam `grid-template-columns: 1fr` (sem `minmax(0, 1fr)`), permitindo que filhos com `white-space: nowrap` (como `.btn`) expandissem a coluna até `373px` e fossem recortados à direita pelo `overflow-x: clip`.
2. **Desalinhamento horizontal entre o Hero e as seções inferiores**: `.step .wrap` sobrescrevia o recuo lateral para `0.75rem` (`12px`), quebrando o alinhamento com `.wrap` (`var(--pad)`) usado no cabeçalho, `#produtos`, `#diferenciais`, `#clientes`, `#orcamento` e rodapé.
3. **Vazamento do painel fechado `.nav-m-panel` e ausência de `safe-area-inset` lateral**: o menu móvel fechado ainda reportava links além da borda direita da tela e as margens laterais não aplicavam `env(safe-area-inset-left/right)` para celulares com notch/Dynamic Island em paisagem.
4. **Sobreposição no Hero em modo paisagem (`844×390`)**: `.stage` mantinha `min-height: 33rem` e `.scrollcue` sobrepunha `.seal` em telas de baixa altura.

### Correções aplicadas

- `src/styles/tokens.css`, `src/styles/base.css`, `src/styles/pages.css`: ajuste de `--pad: clamp(1rem, 4vw, 4.5rem)` e criação de `--pad-left` e `--pad-right` com `max(var(--pad), env(safe-area-inset-*, 0px))` aplicados em `.wrap`, `.nav-m-panel`, `.fab` e `.page-main`; ocultação explícita de `.nav-m:not([open]) .nav-m-panel`; `max-width: 100%` e quebra limpa em `.btn` no mobile.
- `src/styles/hero.css`: remoção da sobrescrita `.step .wrap { padding: 0 0.75rem }` (alinhando o Hero pixel a pixel com todas as seções) e regra `@media (max-height: 33rem)` compactando o cartão e ocultando `.scrollcue` em celulares em paisagem.
- `src/styles/sections.css`: troca de `1fr` para `minmax(0, 1fr)` em todas as grades responsivas, `minmax(min(17rem, 100%), 1fr)` em `.proofs`, `minmax(min(12rem, 100%), 1fr)` em `.ftr-meta`, `min-width: 0` nos itens de grade, `overflow-wrap: anywhere` em `.ftr-meta dd`, padding otimizado de `.model` (`1rem`) e CTA largura total em `#orcamento` no mobile, além de ajuste compacto da `.fab` para telas até `368px`.

### Resultado medido após correções

- **0 elementos com estouro horizontal (`badCount: 0`, `scrollWidth === innerWidth`)** em todas as 8 resoluções testadas (`320×568` até `1440×900`).
- **Alinhamento horizontal idêntico** entre marca no cabeçalho, cartão do Hero, `#produtos`, `#diferenciais`, `#orcamento`, `#quick-quote`, rodapé e `.fab` em todas as larguras móveis e tablets.
