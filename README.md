# Vanpack — Embalagens de Papelão Ondulado

Landing page oficial da **Vanpack** (caixas de papelão sob medida e personalizadas, fábrica em Santo André-SP). Uma página, uma ação: pedir orçamento pelo WhatsApp. No topo, uma história em 5 capítulos mostra a fabricação de uma caixa numa cena 3D ligada ao scroll: a chapa entra na máquina, sai impressa e cortada, é dobrada e colada, vira caixa, é empilhada e segue no caminhão. A página pode rolar sozinha (tour automático) e a pessoa assume o controle a qualquer momento.

- **Manual da marca e diretrizes:** [`docs/manual-da-marca.md`](docs/manual-da-marca.md).
- **Contratos, faixas do scroll, tokens e decisões da v4:** [`docs/notas-de-integracao-v4.md`](docs/notas-de-integracao-v4.md).
- **Slogan:** "Do projeto à entrega".
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
node scripts/icons.mjs   # regenera favicon, ícones do app e manifest a partir do símbolo
npm run og               # regenera public/og.jpg (imagem de compartilhamento) a partir do 1º quadro
```

---

## Configurações institucionais (`site.config.js` e `.env`)

Os dados do site ficam em `site.config.js` e podem ser sobrescritos por variáveis de ambiente. O que não tem dado **não aparece** no HTML (nada de valor de exemplo):

- `VITE_WHATSAPP`: número do WhatsApp, `55` + DDD + número (ex.: `5511912345678`). Vazio: o WhatsApp abre com a mensagem pronta e a pessoa escolhe o contato.
- `VITE_PHONE`, `VITE_EMAIL`: contato (entram só no JSON-LD).
- `VITE_CNPJ`, `VITE_STREET`, `VITE_CEP`, `VITE_HOURS`, `VITE_MAP_URL`: aparecem no rodapé quando preenchidos (CNPJ, endereço, horário e link do mapa).
- `VITE_SITE_URL`: URL canônica pública, terminando em `/` (Open Graph, canonical e JSON-LD).

No build, o plugin do Vite valida o WhatsApp, troca cada `data-wa` por um link `wa.me` com a mensagem pronta, preenche ou remove os campos `data-field` do rodapé e minifica o JSON-LD.

---

## Publicação contínua (GitHub Pages)

A cada push na `master`, o workflow [`deploy.yml`](.github/workflows/deploy.yml) roda o lint, gera o build e publica. Os pull requests passam por [`ci.yml`](.github/workflows/ci.yml): lint, build e os testes de navegador.

> [!IMPORTANT]
> Em **Settings → Pages**, selecione **Source: GitHub Actions**. Isso impede que o builder legado (Jekyll) publique o código-fonte cru.

---

## Arquitetura

```text
index.html                 Página única: CSS inline (tokens da marca), HTML e metadados
site.config.js             Dados institucionais (vazio = não aparece)
vite.config.js             Plugins: links do WhatsApp/rodapé/JSON-LD e CSP por hash dos <style>
src/main.js                Orquestra: história ↔ cena, tour automático, medição de uso
src/story.js               scroll → progresso (0…1), cartão ativo, cabeçalho, dica e botão flutuante
src/tour.js                Tour automático: rola a página pelos 5 capítulos e para no fim da história
src/analytics.js           Medição só por dataLayer (nenhum script de terceiros)
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
- O **tour automático** começa ~0,8 s depois de a cena ficar pronta (no topo, sem `#hash`, sem `?tour=0`, sem movimento reduzido): a página rola sozinha pelos capítulos, **a cena segue o scroll** e o tour para no fim da história (não segue para as seções seguintes), quando o botão "Pedir orçamento" do cabeçalho pulsa. Qualquer roda, toque, clique, tecla ou scroll interrompe, e ele nunca retoma sozinho.
- A qualidade se adapta ao aparelho: densidade limitada (2× no desktop, 1,5× no celular e 4,5 MP), sombra em tempo real só no desktop, e, se os quadros passam de ~24 ms, a resolução cai e depois a sombra para (sem recompilar shaders).

---

## Testes

`npm test` gera o build de produção e o de auditoria e roda, em sequência:

- `tests/tour.test.mjs`: início automático, percurso e parada no fim da história, interrupções (roda, tecla, clique, toque, scroll, aba oculta), `?tour=0`, `#hash`, movimento reduzido. Usa o relógio falso do Playwright.
- `tests/layout.test.mjs`: cartão × cabeçalho × botão flutuante × dica sem sobreposição em 1440×900, 1366×768, 924×540, 720×450, 390×844 e 844×390, nos 5 capítulos; alvos de toque ≥ 44 px.
- `tests/a11y.test.mjs`: estrutura, ordem e visibilidade do foco, cartões `inert`, movimento reduzido e contraste calculado nos estilos reais.
- `tests/robustness.test.mjs`: sem WebGL, worker bloqueado (fallback na thread principal) e contexto WebGL perdido e restaurado.
- `tests/brand.test.mjs`: paleta, tipografia, efeitos proibidos, ausência de raster/rota/pinos/formulário, SVGs da marca, CSP e requisições.
- `tests/scene.test.mjs`: linha do tempo, câmera, estrada, geometria e piso.

---

## Marca, produto e segurança

- Cores: só Floresta, Carvão, Papel e Kraft (o Kraft é o material, nunca texto ou botão); só Archivo; logotipo sempre em curvas, em negativo sobre Floresta, com respiro de ¼ do símbolo.
- Sem imagem raster da cena, sem formulário, sem depoimentos, sem números ou alegações inventados.
- CSP por `<meta>` com hash de cada `<style>` (`script-src 'self'`, sem CDN, sem `eval`); links externos com `rel="noopener"`.
