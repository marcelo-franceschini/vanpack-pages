# Vanpack: Embalagens de Papelão Ondulado

Landing page oficial da **Vanpack** (caixas de papelão sob medida, divisórias e chapas, fábrica em Santo André-SP). Uma página, uma ação: pedir orçamento pelo WhatsApp, atendido por um assistente. No topo, uma cena 3D ligada ao scroll (a fabricação de uma caixa, da chapa ao caminhão) acompanha 5 cartões que falam do que importa a quem pede: a chamada, anos de mercado, qualidade, orçamento e entrega. A página rola sozinha (tour automático) e a pessoa assume o controle a qualquer momento.

- **Manual da marca e diretrizes:** [`docs/manual-da-marca.md`](docs/manual-da-marca.md).
- **3D de cada produto** (referência, decisões e como funciona): [`docs/produtos-3d.md`](docs/produtos-3d.md).
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
npm run build          # gera dist/ (CSP por hash, workers da cena, three.js num arquivo só, SVGs e fonte)
npm run build:audit    # build de auditoria em dist-audit/ (expõe contadores do renderer)
npm run preview        # serve o dist/ localmente
npm run lint           # ESLint + Prettier (o mesmo do CI)
npm run format         # formata tudo com o Prettier
npm test               # build + build de auditoria + testes de navegador (Playwright)
```

Auditorias (medem; os orçamentos estão no cabeçalho de cada script):

```bash
npm run audit:bundle      # gzip/brotli por arquivo, JS inicial (≤ 165 KB gzip), visita completa, maiores módulos
npm run audit:scene       # draw calls e triângulos nos 5 centros (≤ 90 desktop, ≤ 60 celular)
npm run audit:produtos    # draw calls do 3D de cada produto (≤ 60 por modelo) e memória ao rolar (precisa do build:audit)
npm run audit:runtime     # tarefas longas e quadros ao rolar a história, com CPU 1× e 4×
npm run audit:lighthouse  # Lighthouse mobile e desktop (mediana de 3 execuções; baixa via npx)
npm run audit:capturas    # capturas da história e das seções, em docs/capturas/ (fora do git)
npm run audit:paridade    # compara pixel a pixel com a master (ou --base=<ref>): 6 tamanhos, 5 quadros, 5 seções; diferenças em dist-paridade/
```

Manutenção da marca (rodam à mão, não fazem parte do build):

```bash
node scripts/brand.mjs   # regenera os SVGs de public/brand/, a fonte e src/brand/marks.js (precisa do uv)
node scripts/icons.mjs   # regenera favicon, apple-touch-icon e icon-512 (logo do JSON-LD) a partir do símbolo
npm run amostra -- 0.05 0.06   # tamanho de amostra por variante de um teste A/B
npm run og               # regenera public/og.jpg (imagem de compartilhamento) a partir do 1º quadro
node scripts/produtos-svg.mjs   # regenera as ilustrações dos produtos (public/produtos/), o fallback do 3D
```

---

## Seções da página

Cabeçalho fixo, a história 3D (`#processo`, com 5 cartões que nunca somem), a faixa de confiança (`#confianca`: cidade, CNPJ, "Nunca pedimos pagamento para conta de pessoa física", anos de mercado, formas de pagamento, mapa e telefone), "O que fabricamos" (`#produtos`: Corte e vinco; Divisórias, tabuleiros e separadores; Chapas de papelão ondulado, cada um com um 3D da peça girando no topo do cartão e o seu botão de orçamento, e pedido mínimo e região; o 3D só é baixado quando a seção chega perto e, em aparelho sem condição, vira uma ilustração em SVG: [`docs/produtos-3d.md`](docs/produtos-3d.md)), os diferenciais (`#diferenciais`, do `.env`), os clientes (`#clientes`: carrossel de logos do `.env` em qualquer largura, uma esteira lenta da direita para a esquerda com botão Pausar/Retomar, setas, teclado e arrasto, que fica parada e centralizada quando os logos cabem na largura; só cliente autorizado em production e exemplos em demo; e depoimentos autorizados), o CTA final (`#orcamento`) e o rodapé. As seções alternam Papel, tint e Floresta, com a onda de papelão como divisor. A página não tem e-mail, prazo, promessa de tempo de resposta nem texto sobre o processo de fabricação (o `tests/conteudo.test.mjs` confere). O botão do WhatsApp fica fixo: no desktop é redondo e aparece depois da história; em telas de até 768 px é uma barra de largura total com o telefone, que aparece já no 2º capítulo (o botão do cabeçalho sai enquanto ela está à vista); os dois somem com o CTA final à vista. Se a página continua à vista 2,5 s depois do toque num botão do WhatsApp, sobe a folha "O WhatsApp não abriu?" (`#zap-ajuda`): copiar o número, ligar e, dentro do Instagram, Facebook ou TikTok, como abrir no navegador. Cada seção sem dado (e o link para ela) some sozinha.

---

## Dados da empresa (`.env`)

Todo dado da empresa (CNPJ, telefone, WhatsApp, endereço, pedido mínimo, diferenciais, clientes…) vive só no `.env`, que é versionado: a fonte única do rodapé, do JSON-LD, dos links do WhatsApp, do `robots.txt` e do `sitemap.xml`. O [`.env.example`](.env.example) guarda os valores fictícios de demonstração e comenta cada chave; [`docs/go-live.md`](docs/go-live.md) explica como trocar tudo pelos dados reais editando **só o `.env`**. O que não tem dado **não aparece** no HTML (nada de valor de exemplo), e nenhum desses dados é escrito à mão no código (um teste confere).

- `VITE_DATA_MODE`: `demo` (dados fictícios: o HTML sai com `noindex` e o `robots.txt` bloqueia tudo) ou `production` (o build falha se faltar dado obrigatório, se o formato for inválido ou se sobrar valor fictício do `.env.example`; outro valor também falha).
- `VITE_WHATSAPP` (obrigatório nos dois modos: `55` + DDD + número, ex.: `5511912345678`; o build nunca gera `wa.me/?text=…` sem número), `VITE_SITE_URL` (termina em `/`: canonical, Open Graph, JSON-LD, robots e sitemap).
- Contato e endereço: `VITE_PHONE`, `VITE_PHONE_DISPLAY`, `VITE_CNPJ`, `VITE_LEGAL_NAME`, `VITE_STREET`, `VITE_DISTRICT`, `VITE_CITY`, `VITE_STATE`, `VITE_CEP`, `VITE_HOURS`, `VITE_HOURS_SCHEMA`, `VITE_MAP_URL`.
- `VITE_FOUNDED_YEAR`: o "N anos de mercado" e o © são calculados dele (no build e de novo no navegador), então não precisam de edição anual.
- Operacionais: `VITE_MIN_ORDER`, `VITE_SERVICE_AREA`, `VITE_PAYMENT_METHODS`.
- Diferenciais e clientes, em chaves numeradas: `VITE_DIFF_<n>_TITLE`, `_TEXT` e `_ICON` (até 6; ícone `fabrica`, `lotes`, `conversa` ou `caixa`) e `VITE_CLIENT_<n>_NAME`, `_LOGO` (arquivo SVG em `public/clientes/`) e `_AUTH` (até 12; em production só aparece o cliente com `AUTH=sim`, que precisa de registro em [`docs/provas/`](docs/provas/README.md)). Item sem título ou sem nome some; seção sem item some.
- Medição sem cookies: `VITE_ANALYTICS_PROVIDER` (`umami` ou vazio), `VITE_ANALYTICS_SITE` e `VITE_ANALYTICS_ENDPOINT`.

No build, o `site.config.js` monta a config a partir do `.env` (`createSiteConfig`), o `build/validate.js` confere a trava de go-live, o `build/render.js` escreve os dados no HTML (links `wa.me`, campos `data-field` do rodapé, trechos `data-need` e o texto alternativo `data-need="!chave"`, `{{variáveis}}`, produtos, diferenciais, clientes, JSON-LD e o `noindex` em demo) e o `build/files.js` gera `robots.txt` e `sitemap.xml`. `{{variável}}` vazia fora de um `data-need` é erro de build.

---

## Medição (Umami Cloud, sem cookies)

Todo evento vai para o `dataLayer`. Com `VITE_ANALYTICS_PROVIDER=umami`, os de negócio também vão ao Umami Cloud pelo nosso próprio JS (nenhum script de terceiro), só na página publicada: o host da `VITE_SITE_URL`, então dev, preview e testes nunca sujam a medição. Para caber nos 100 mil eventos por mês do plano grátis, o Umami recebe só a visualização da página, `whatsapp_click`, `handoff_fail` (o WhatsApp não abriu depois do clique), `whatsapp_copy` (copiou o número na folha de ajuda), `phone_click`, `map_click`, `cta_view` e um `visit_summary` por visita (capítulo e rolagem máximos, tour, `scene` (ms até a cena aparecer, que o LCP não mede; 0 = sem 3D), LCP, INP e CLS). Dentro do navegador do Instagram, Facebook ou TikTok todo evento leva `inapp` (`ig`, `fb` ou `tt`).

Eventos do `dataLayer`: `whatsapp_click{cta}`, `handoff_fail{cta}`, `whatsapp_copy{ok}`, `scene_ready{ms}`, `phone_click` e `map_click` (`{cta}` é o lugar do link), `cta_view`, `chapter_view`, `scroll_depth`, `section_view{section_id}`, `web_vitals{name,value}`, `first_interaction` e os do tour. Sem cookies, sem storage e sem banner; a [política de privacidade](politica-de-privacidade.html) explica. Criação da conta: [`docs/go-live.md`](docs/go-live.md).

**Cliques × conversas.** Cada botão põe o código de origem no fim da mensagem (`[site-hero]`, `[site-produtos-chapas]`…), e dentro do Instagram, Facebook ou TikTok o código ganha o sufixo do app (`[site-hero-ig]`). Para saber quantos cliques viraram conversa, conte as conversas com cada código no período e divida pelos `whatsapp_click` daquele `cta` (e `inapp`) no Umami. O `handoff_fail` mostra onde o WhatsApp não abriu. Limite conhecido: no navegador do Instagram ou do Facebook o wa.me às vezes abre dentro do próprio app; a página sai de vista e isso não conta como falha, então quem mede esse caso é o sufixo `-ig`/`-fb` nas conversas.

---

## Publicação contínua (GitHub Pages)

A cada push na `master`, o workflow [`deploy.yml`](.github/workflows/deploy.yml) roda o lint, gera o build e publica. Os pull requests passam por [`ci.yml`](.github/workflows/ci.yml): lint, build e os testes de navegador.

> [!IMPORTANT]
> Em **Settings → Pages**, selecione **Source: GitHub Actions**. Isso impede que o builder legado (Jekyll) publique o código-fonte cru.

---

## Arquitetura

```text
index.html                 Página única: CSS inline (tokens da marca), HTML e metadados
site.config.js             Marca, produtos, provas e createSiteConfig(env): monta a config do .env
build/render.js            Escreve os dados no HTML (WhatsApp, rodapé, {{variáveis}}, diferenciais, clientes, JSON-LD)
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
src/handoff.js             "O WhatsApp não abriu?": folha de ajuda e navegador embutido (Instagram, Facebook, TikTok)
src/carrossel.js           Carrossel de clientes: esteira na Web Animations API, pausa, setas, teclado e arrasto
src/produtos/              3D de cada produto: gatilho (JS inicial), montagem na página, worker com um WebGL só e os 3 modelos
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

- A cena 3D é uma função de `p` (0…1): o scroll da seção `.story` (560 svh no desktop e 400 svh no celular, com o palco fixo na tela) vira `p`, e o render só desenha quando `p` muda.
- O render roda num **Web Worker** com `OffscreenCanvas`, então a thread principal fica livre. Sem suporte (ou se o worker falhar), a mesma cena roda na thread principal; sem WebGL, ficam o fundo Papel, o símbolo e os cartões, que continuam legíveis e navegáveis.
- O **tour automático** começa no instante em que a cena fica pronta, sem espera e em qualquer tela (no topo, sem `#hash`, sem `?tour=0`, sem movimento reduzido no sistema; `?tour=1` força o tour mesmo com movimento reduzido, para testar): a página rola sozinha pelos capítulos em ~18 s, **a cena segue o scroll** e o tour para no fim da história (não segue para as seções seguintes), quando o botão "Pedir orçamento" do cabeçalho pulsa. No F5 a página volta ao topo e o tour toca de novo. Qualquer roda, toque, clique, tecla ou scroll interrompe, e ele nunca retoma sozinho. Quando o tour não começa, o console diz o motivo (`[vanpack] autoplay não iniciou: …`).
- A qualidade se adapta ao aparelho: densidade limitada (2× no desktop, 1,5× no celular e 4,5 MP), sombra em tempo real só no desktop, e, se os quadros passam de ~24 ms, a resolução cai e depois a sombra para (sem recompilar shaders).

---

## Testes

`npm test` gera o build de produção e o de auditoria e roda, em sequência:

- `tests/conversion.test.mjs`: nenhum botão do WhatsApp sem número, código de origem `[site-…]` na mensagem, mensagem curta (sem lacunas) e campanha (`utm_*`) no texto, sem cookie nem storage.
- `tests/handoff.test.mjs`: folha "O WhatsApp não abriu?" (sobe em 2,5 s com a página à vista, não sobe se o app abre, fecha sozinha se ele abre depois, Esc, "Fechar", Ctrl+clique e copiar número) e navegador embutido (user agent, código `[site-hero-ig]` e a instrução). Usa o relógio falso do Playwright.
- `tests/trust.test.mjs`: faixa de confiança (com a regra do pagamento) e anos de mercado/© recalculados no navegador (relógio em 2031).
- `tests/analytics.test.mjs`: eventos no Umami (interceptado, nenhum tráfego real), resumo da visita, sem cookie nem storage e nada enviado fora do host do site.
- `tests/site-config.test.mjs`: config, trava de go-live (demo × production), render com a config vazia, os 5 cartões com qualquer config, produtos, diferenciais e clientes do `.env`, JSON-LD, robots e sitemap; puro, sem navegador.
- `tests/conteudo.test.mjs`: nada de e-mail, prazo, promessa de tempo de resposta, texto de processo industrial ou travessão no que a página mostra ou faz um leitor de tela ler (texto, aria-label, alt, title, metas, JSON-LD e mensagens do WhatsApp), em demo, em production e no build publicado; puro.
- `tests/trava-3d.test.mjs`: o 3D principal é intocável: compara o sha256 de `src/scene/`, `src/render/` e `tests/scene.test.mjs` com `tests/fixtures/3d-lock.json`.
- `tests/data-source.test.mjs`: nenhum dado do `.env` escrito à mão no código, o `.env` chega à página publicada e todo número visível vem da config.
- `tests/site-url.test.mjs`: build em production com domínio próprio: canonical, Open Graph, JSON-LD, robots, sitemap e medição derivam todos da `VITE_SITE_URL`.
- `tests/experiments.test.mjs` e `tests/wizard.test.mjs`: sorteio, persistência, data de término e variante forçada; o assistente de 3 passos (mensagem, validação, teclado, rótulos, contraste e celular).
- `tests/tour.test.mjs`: início automático, percurso e parada no fim da história, interrupções (roda, tecla, clique, toque, scroll, aba oculta e o link "Ver produtos ↓"), `?tour=0`, `#hash`, movimento reduzido e, no celular, o pulso da barra no fim. Usa o relógio falso do Playwright.
- `tests/carrossel.test.mjs`: carrossel de clientes em 1440×900 e 390×844: anda sozinho para a esquerda, pausa com o mouse, com foco de teclado, ao tocar e pelo botão (que só volta pelo botão), setas, teclado e arrasto movem, movimento reduzido sem movimento automático, poucos clientes parados e centralizados sem cópias nem controles, cópias com `aria-hidden` e `inert`, sem sobreposição, sem rolagem horizontal e alvos de 44 px.
- `tests/produtos.test.mjs`: 3D de cada produto: nenhum chunk antes de a seção chegar perto, monta ao rolar e não fica em branco, gira, só desenha o que está à vista, longe libera tudo e o worker sai, movimento reduzido parado, no máximo 1 contexto WebGL além do da história, sem vazamento ao rolar para dentro e para fora, contexto perdido e restaurado, ilustração em SVG sem WebGL, com economia de dados, rede 3g ou 2 GB de memória (sem salto de layout), e os 3 botões de orçamento funcionando.
- `tests/layout.test.mjs`: cartão × cabeçalho × botão flutuante × dica sem sobreposição em 1440×900, 1366×768, 924×540, 720×450, 360×640, 390×844 e 844×390, nos 5 capítulos; alvos de toque ≥ 44 px; no celular, a barra do 2º capítulo em diante e a 1ª tela com título, pedido mínimo, botão e linha de risco sem rolar; produtos em 3 colunas no desktop e 1 no celular, com a área 4:3 do 3D no topo de cada cartão, sem salto de layout ao carregar.
- `tests/a11y.test.mjs`: estrutura, ordem e visibilidade do foco, cartões `inert`, movimento reduzido e contraste calculado nos estilos reais.
- `tests/robustness.test.mjs`: sem WebGL, worker bloqueado (fallback na thread principal) e contexto WebGL perdido e restaurado.
- `tests/brand.test.mjs`: paleta, tipografia, efeitos proibidos, ausência de raster/rota/pinos/formulário, SVGs da marca, CSP e requisições.
- `tests/scene.test.mjs`: linha do tempo, câmera, estrada, geometria e piso.
- `tests/orcamento.test.mjs`: tetos de bytes do `dist/` (gzip por arquivo, JS inicial, carga inicial e visita completa); os tetos só descem.
- `tests/three-compartilhado.test.mjs`: o three.js é um arquivo só (`assets/three-*.js`), importado pelos dois workers e pelo render de reserva, que não levam cópia; os imports do `src/` só por nome.

---

## Marca, produto e segurança

- Cores: só Floresta, Carvão, Papel e Kraft (o Kraft é o material, nunca texto ou botão); só Archivo; logotipo sempre em curvas, em negativo sobre Floresta, com respiro de ¼ do símbolo.
- Sem imagem raster (nenhuma foto: só SVG; logos de clientes também só em SVG), sem formulário, sem números ou alegações inventados. Logo de cliente (do `.env`, com `AUTH=sim`), depoimento e nota do Google só com autorização registrada em [`docs/provas/`](docs/provas/README.md); em demo, os clientes de exemplo levam o rótulo "Exemplo".
- Sem PWA: sem manifest, sem service worker e sem instalação como app (decisão do dono: é uma landing de um só objetivo). Ficam `theme-color`, os favicons, o `apple-touch-icon` e o `icon-512.png`, que o JSON-LD usa como logo.
- CSP por `<meta>` com hash de cada `<style>` (`script-src 'self'`, sem CDN, sem `eval`); o único domínio externo é o servidor da medição (Umami), e só com provedor configurado; links externos com `rel="noopener"`.
