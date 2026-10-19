# Vanpack — Embalagens de Papelão Ondulado

Landing page oficial da **Vanpack** (caixas de papelão sob medida e personalizadas, fábrica em Santo André-SP). Uma página, uma ação: pedir orçamento pelo WhatsApp. No topo, uma história em 5 capítulos mostra a fabricação de uma caixa numa cena 3D ligada ao scroll: a chapa entra na máquina, sai impressa e cortada, é dobrada e colada, vira caixa, é empilhada e segue no caminhão. A página pode rolar sozinha (tour automático) e a pessoa assume o controle a qualquer momento.

- **Manual da marca e diretrizes:** [`docs/manual-da-marca.md`](docs/manual-da-marca.md).
- **Contratos, faixas do scroll, tokens e decisões da v4:** [`docs/notas-de-integracao-v4.md`](docs/notas-de-integracao-v4.md).
- **Slogan:** "Do projeto à entrega".
- **Passo a passo para ir ao ar com dados reais:** [`docs/go-live.md`](docs/go-live.md).
- **Experimentos A/B** (regras, métrica, amostra e como ligar): [`docs/experimentos.md`](docs/experimentos.md).
- **Assets oficiais em vetor:** [`public/brand/`](public/brand/).

---

## Comandos

Requer Node.js 22.12+. Os testes e as auditorias usam o Chrome do sistema (`CHROME_PATH`, padrão `/usr/bin/google-chrome-stable`) com WebGL por software.

```bash
npm install
npm run dev            # servidor de desenvolvimento
npm run build          # gera dist/ (CSP por hash, worker da cena, SVGs e fonte)
npm run build:audit    # build de auditoria em dist-audit/ (expõe contadores do renderer)
npm run preview        # serve o dist/ localmente
npm run lint           # ESLint + Prettier (o mesmo do CI)
npm run format         # formata tudo com o Prettier
npm test               # build + build de auditoria + testes de navegador (Playwright)
```

Auditorias (medem; os orçamentos estão no cabeçalho de cada script):

```bash
npm run audit:bundle      # gzip/brotli por arquivo, JS inicial (≤ 165 KB gzip), maiores módulos
npm run audit:scene       # draw calls e triângulos nos 5 centros (≤ 90 desktop, ≤ 60 celular)
npm run audit:runtime     # tarefas longas e quadros ao rolar a história, com CPU 1× e 4×
npm run audit:lighthouse  # Lighthouse mobile e desktop (mediana de 3 execuções; baixa via npx)
npm run audit:capturas    # as 10 capturas em tamanho real, em docs/capturas/ (fora do git)
```

Manutenção da marca (rodam à mão, não fazem parte do build):

```bash
node scripts/brand.mjs   # regenera os SVGs de public/brand/, a fonte e src/brand/marks.js (precisa do uv)
node scripts/icons.mjs   # regenera favicon, apple-touch-icon e icon-512 (logo do JSON-LD) a partir do símbolo
npm run amostra -- 0.05 0.06   # tamanho de amostra por variante de um teste A/B
npm run og               # regenera public/og.jpg (imagem de compartilhamento) a partir do 1º quadro
```

---

## Seções da página

Cabeçalho fixo, a história 3D (`#processo`), a faixa de confiança (`#confianca`: cidade, CNPJ, anos de mercado, mapa, telefone e e-mail), "O que fabricamos" (`#produtos`: 4 modelos de caixa, cada um com o seu botão de orçamento, e pedido mínimo, prazo e região), os diferenciais (`#diferenciais`), os clientes (`#clientes`: só prova autorizada, e exemplos em demo), o FAQ (`#faq`, `<details>`), o CTA final (`#orcamento`) e o rodapé. O botão do WhatsApp fica fixo depois da história: redondo no desktop e barra de largura total com o telefone em telas de até 768 px, e some com o CTA final à vista. Cada seção sem dado (e o link para ela) some sozinha.

---

## Dados da empresa (`.env`)

Todo dado da empresa (CNPJ, telefone, WhatsApp, endereço, prazos…) vive só no `.env`, que é versionado: a fonte única do rodapé, do JSON-LD, dos links do WhatsApp, do `robots.txt` e do `sitemap.xml`. O [`.env.example`](.env.example) guarda os valores fictícios de demonstração e comenta cada chave; [`docs/go-live.md`](docs/go-live.md) explica como trocar tudo pelos dados reais editando **só o `.env`**. O que não tem dado **não aparece** no HTML (nada de valor de exemplo), e nenhum desses dados é escrito à mão no código (um teste confere).

- `VITE_DATA_MODE`: `demo` (dados fictícios: o HTML sai com `noindex` e o `robots.txt` bloqueia tudo) ou `production` (o build falha se faltar dado obrigatório, se o formato for inválido ou se sobrar valor fictício do `.env.example`; outro valor também falha).
- `VITE_WHATSAPP` (obrigatório nos dois modos: `55` + DDD + número, ex.: `5511912345678`; o build nunca gera `wa.me/?text=…` sem número), `VITE_SITE_URL` (termina em `/`: canonical, Open Graph, JSON-LD, robots e sitemap).
- Contato e endereço: `VITE_PHONE`, `VITE_PHONE_DISPLAY`, `VITE_EMAIL`, `VITE_CNPJ`, `VITE_LEGAL_NAME`, `VITE_STREET`, `VITE_DISTRICT`, `VITE_CITY`, `VITE_STATE`, `VITE_CEP`, `VITE_HOURS`, `VITE_HOURS_SCHEMA`, `VITE_MAP_URL`.
- `VITE_FOUNDED_YEAR`: o "N anos de mercado" e o © são calculados dele (no build e de novo no navegador), então não precisam de edição anual.
- Operacionais: `VITE_MIN_ORDER`, `VITE_LEAD_TIME_DAYS`, `VITE_SERVICE_AREA`, `VITE_PAYMENT_METHODS`, `VITE_WHATSAPP_HOURS` (horário do assistente do WhatsApp; vazio, a página não promete resposta na hora).
- Medição sem cookies: `VITE_ANALYTICS_PROVIDER` (`umami` ou vazio), `VITE_ANALYTICS_SITE` e `VITE_ANALYTICS_ENDPOINT`.

No build, o `site.config.js` monta a config a partir do `.env` (`createSiteConfig`), o `build/validate.js` confere a trava de go-live, o `build/render.js` escreve os dados no HTML (links `wa.me`, campos `data-field` do rodapé, trechos `data-need`, `{{variáveis}}`, JSON-LD e o `noindex` em demo) e o `build/files.js` gera `robots.txt` e `sitemap.xml`. `{{variável}}` vazia fora de um `data-need` é erro de build.

---

## Medição (Umami Cloud, sem cookies)

Todo evento vai para o `dataLayer`. Com `VITE_ANALYTICS_PROVIDER=umami`, os de negócio também vão ao Umami Cloud pelo nosso próprio JS (nenhum script de terceiro), só na página publicada: o host da `VITE_SITE_URL`, então dev, preview e testes nunca sujam a medição. Para caber nos 100 mil eventos por mês do plano grátis, o Umami recebe só a visualização da página, `whatsapp_click`, `phone_click`, `email_click`, `map_click`, `cta_view`, `faq_open` e um `visit_summary` por visita (capítulo e rolagem máximos, tour e LCP, INP e CLS).

Eventos do `dataLayer`: `whatsapp_click{cta}`, `phone_click`, `email_click` e `map_click` (`{cta}` é o lugar do link), `cta_view`, `chapter_view`, `scroll_depth`, `section_view{section_id}`, `faq_open{question_id}`, `web_vitals{name,value}`, `first_interaction` e os do tour. Sem cookies, sem storage e sem banner; a [política de privacidade](politica-de-privacidade.html) explica. Criação da conta: [`docs/go-live.md`](docs/go-live.md).

---

## Publicação contínua (GitHub Pages)

A cada push na `master`, o workflow [`deploy.yml`](.github/workflows/deploy.yml) roda o lint, gera o build e publica. Os pull requests passam por [`ci.yml`](.github/workflows/ci.yml): lint, build e os testes de navegador.

> [!IMPORTANT]
> Em **Settings → Pages**, selecione **Source: GitHub Actions**. Isso impede que o builder legado (Jekyll) publique o código-fonte cru.

---

## Arquitetura

```text
index.html                 Página única: CSS inline (tokens da marca), HTML e metadados
site.config.js             Marca, conteúdo (modelos, FAQ, provas) e createSiteConfig(env): monta a config do .env
build/render.js            Escreve os dados no HTML (WhatsApp, rodapé, {{variáveis}}, JSON-LD, noindex)
build/validate.js          Trava de go-live: demo × production
build/files.js             robots.txt e sitemap.xml gerados da URL do site
build/env.js               Leitor de .env fora do Vite (o .env.example)
vite.config.js             Plugins: dados no HTML, robots/sitemap e CSP por hash dos <style>
src/years.js               Anos de mercado e ano do © (build e navegador)
src/main.js                Orquestra: história ↔ cena, tour automático, medição de uso
src/story.js               scroll → progresso (0…1), cartão ativo, cabeçalho, dica e botão flutuante
src/tour.js                Tour automático: rola a página pelos 5 capítulos e para no fim da história
src/analytics.js           Medição: dataLayer + Umami Cloud (sem cookies, só na página publicada)
src/vitals.js              Core Web Vitals reais (web-vitals, carregado com o navegador ocioso)
src/experiments.js         Experimentos A/B (variante por visita no sessionStorage, ?exp_<nome>=B força)
src/wizard.js              Assistente de orçamento da variante B do experimento quote_wizard
build/csp.js               CSP por hash dos <style> (e o servidor da medição, se houver)
politica-de-privacidade.html  2ª página: política de privacidade com os dados do .env
src/render/stage.js        Liga o canvas ao render: Web Worker (OffscreenCanvas) ou thread principal
src/render/worker.js       Ponto de entrada do worker
src/render/controller.js   Loop de render sob demanda, suavização, qualidade adaptativa, contexto perdido
src/scene/                 Cena 3D procedural: factory/truck/hero/timeline/camera/geometry/textures
src/brand/marks.js         Caminhos da marca em curvas (gerado por scripts/brand.py)
public/brand/              SVGs oficiais da marca (Floresta, Carvão, Papel e negativos)
public/fonts/              Archivo (WOFF2, pesos 400 a 900)
scripts/audit/             Auditorias: bundle, cena, runtime, Lighthouse e capturas
tests/                     Testes de navegador (Playwright) e da cena (node:test)
docs/                      Manual da marca e notas da v4
```

### Como a história funciona

- A cena 3D é uma função de `p` (0…1): o scroll da seção `.story` (560 svh, com o palco fixo na tela) vira `p`, e o render só desenha quando `p` muda.
- O render roda num **Web Worker** com `OffscreenCanvas`, então a thread principal fica livre. Sem suporte (ou se o worker falhar), a mesma cena roda na thread principal; sem WebGL, ficam o fundo Papel, o símbolo e os cartões, que continuam legíveis e navegáveis.
- O **tour automático** começa no instante em que a cena fica pronta, sem espera e em qualquer tela (no topo, sem `#hash`, sem `?tour=0`, sem movimento reduzido no sistema; `?tour=1` força o tour mesmo com movimento reduzido, para testar): a página rola sozinha pelos capítulos em ~18 s, **a cena segue o scroll** e o tour para no fim da história (não segue para as seções seguintes), quando o botão "Pedir orçamento" do cabeçalho pulsa. No F5 a página volta ao topo e o tour toca de novo. Qualquer roda, toque, clique, tecla ou scroll interrompe, e ele nunca retoma sozinho. Quando o tour não começa, o console diz o motivo (`[vanpack] autoplay não iniciou: …`).
- A qualidade se adapta ao aparelho: densidade limitada (2× no desktop, 1,5× no celular e 4,5 MP), sombra em tempo real só no desktop, e, se os quadros passam de ~24 ms, a resolução cai e depois a sombra para (sem recompilar shaders).

---

## Testes

`npm test` gera o build de produção e o de auditoria e roda, em sequência:

- `tests/conversion.test.mjs`: nenhum botão do WhatsApp sem número, código de origem `[site-…]` na mensagem e campanha (`utm_*`) no texto, sem cookie nem storage.
- `tests/trust.test.mjs`: faixa de confiança e anos de mercado/© recalculados no navegador (relógio em 2031).
- `tests/analytics.test.mjs`: eventos no Umami (interceptado, nenhum tráfego real), resumo da visita, sem cookie nem storage e nada enviado fora do host do site.
- `tests/site-config.test.mjs`: config, trava de go-live (demo × production), render com a config vazia, JSON-LD, robots e sitemap; puro, sem navegador.
- `tests/data-source.test.mjs`: nenhum dado do `.env` escrito à mão no código, o `.env` chega à página publicada e todo número visível vem da config.
- `tests/faq.test.mjs`: FAQ por teclado (abre, fecha, foco visível, 44 px) e o evento `faq_open`.
- `tests/site-url.test.mjs`: build em production com domínio próprio: canonical, Open Graph, JSON-LD, robots, sitemap e medição derivam todos da `VITE_SITE_URL`.
- `tests/experiments.test.mjs` e `tests/wizard.test.mjs`: sorteio, persistência, data de término e variante forçada; o assistente de 3 passos (mensagem, validação, teclado, rótulos, contraste e celular).
- `tests/tour.test.mjs`: início automático, percurso e parada no fim da história, interrupções (roda, tecla, clique, toque, scroll, aba oculta), `?tour=0`, `#hash`, movimento reduzido. Usa o relógio falso do Playwright.
- `tests/layout.test.mjs`: cartão × cabeçalho × botão flutuante × dica sem sobreposição em 1440×900, 1366×768, 924×540, 720×450, 390×844 e 844×390, nos 5 capítulos; alvos de toque ≥ 44 px.
- `tests/a11y.test.mjs`: estrutura, ordem e visibilidade do foco, cartões `inert`, movimento reduzido e contraste calculado nos estilos reais.
- `tests/robustness.test.mjs`: sem WebGL, worker bloqueado (fallback na thread principal) e contexto WebGL perdido e restaurado.
- `tests/brand.test.mjs`: paleta, tipografia, efeitos proibidos, ausência de raster/rota/pinos/formulário, SVGs da marca, CSP e requisições.
- `tests/scene.test.mjs`: linha do tempo, câmera, estrada, geometria e piso.

---

## Marca, produto e segurança

- Cores: só Floresta, Carvão, Papel e Kraft (o Kraft é o material, nunca texto ou botão); só Archivo; logotipo sempre em curvas, em negativo sobre Floresta, com respiro de ¼ do símbolo.
- Sem imagem raster (nenhuma foto: só SVG; logos de clientes também só em SVG), sem formulário, sem números ou alegações inventados. Depoimento, logo de cliente e nota do Google só com autorização registrada em [`docs/provas/`](docs/provas/README.md); itens de exemplo só em modo demo, com o rótulo "Exemplo".
- Sem PWA: sem manifest, sem service worker e sem instalação como app (decisão do dono: é uma landing de um só objetivo). Ficam `theme-color`, os favicons, o `apple-touch-icon` e o `icon-512.png`, que o JSON-LD usa como logo.
- CSP por `<meta>` com hash de cada `<style>` (`script-src 'self'`, sem CDN, sem `eval`); o único domínio externo é o servidor da medição (Umami), e só com provedor configurado; links externos com `rel="noopener"`.
