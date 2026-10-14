# Vanpack — Embalagens de Papelão Ondulado

Landing page oficial da **Vanpack** (caixas de papelão sob medida e personalizadas, fábrica em Santo André-SP) com animação 3D interativa da linha de produção guiada pelo scroll. O foco central de conversão da página é a solicitação direta de orçamento pelo WhatsApp com a equipe técnica da fábrica.

- **Manual da marca e diretrizes:** consulte [`docs/manual-da-marca.md`](docs/manual-da-marca.md).
- **Slogan:** "Do projeto à entrega".
- **Assets oficiais em vetor:** pasta [`public/brand/`](public/brand/) e [`assets/brand/`](assets/brand/).

---

## Comandos

Requer Node.js 22.12+.

```bash
npm install
npm run dev       # servidor de desenvolvimento local
npm run build     # gera dist/ com hash de CSP e otimizações
npm run preview   # serve o dist/ localmente para conferência
npm run lint      # ESLint + Prettier (o mesmo rodado no CI)
npm run format    # formata todos os arquivos com Prettier
npm run poster    # regenera os pôsteres e imagem OG via Chrome Headless
```

---

## Configurações Institucionais (`site.config.js` e `.env`)

Os dados do site são gerenciados de forma centralizada em `site.config.js` e suportam sobreposição por variáveis de ambiente:

- `VITE_WHATSAPP`: número para contato via WhatsApp, no formato `55` + DDD + número (ex.: `5511912345678`).
- `VITE_PHONE`: telefone fixo ou canal de voz. Se vazio, links e botões de chamada direta são omitidos.
- `VITE_CNPJ`: CNPJ oficial da empresa. Se vazio, não é renderizado no rodapé nem polui o código.
- `VITE_SITE_URL`: URL canônica pública do site (utilizada em Open Graph, canonical e sitemap).

No build, o plugin do Vite lê as configurações institucionais, valida o formato do WhatsApp, calcula os links seguros com mensagens predefinidas e injeta os dados estruturados no schema JSON-LD.

---

## Publicação Contínua (GitHub Pages)

A cada push na branch `master`, o workflow `.github/workflows/deploy.yml` executa validação de lint, build dos assets e publicação para o GitHub Pages.

> [!IMPORTANT]
> Em **Settings → Pages** do repositório no GitHub, selecione **Source: GitHub Actions**. Isso impede que o builder legado (Jekyll) sobrescreva o bundle compilado com o código-fonte cru.

---

## Arquitetura da Solução

```
index.html                 Página principal, CSS inline com tokens oficiais, metadados e SVG sprite
site.config.js             Configurações institucionais da marca e dados de contato
docs/manual-da-marca.md    Manual de identidade visual e regras de uso da marca Vanpack v1.0
src/main.js                Orquestração de scroll, tour automático, cartões e analytics
src/pins.js                Anotações didáticas flutuantes (callout pins) das máquinas na cena 3D
src/route.js               Barra de navegação passo a passo com rota tracejada e caminhão
src/tour.js                Tour automático suave com aceleração, pausas didáticas e controle do usuário
src/brand/marks.js         Vetores e traçado procedurais da marca oficial em canvas
src/render/stage.js        Inicializador do estágio 3D em Web Worker (com fallback inline)
src/render/worker.js       Execução de Three.js fora da thread principal
src/render/controller.js   Loop de animação, qualidade adaptativa e micro-movimento ambiental (sway)
src/scene/                 Modelagem 3D procedual: diorama de fábrica, máquinas, caixas e caminhão
public/brand/              SVGs oficiais da marca em curvas (Floresta, Carvão e Negativo)
public/fonts/              Fonte Archivo instanciada em WOFF2 (pesos 400 a 900)
public/robots.txt          Instruções para indexadores de busca
public/sitemap.xml         Mapa do site para SEO
public/404.html            Página de erro 404 estilizada com a identidade visual da marca
scripts/poster.mjs         Geração automatizada de WebP e imagens de compartilhamento social
```

---

## Acessibilidade e Performance

- **Lighthouse:** 100/100/100/100 em dispositivos móveis e desktop.
- **Thread Principal Livre:** Three.js, compilação de shaders paralelos e renderização em `OffscreenCanvas` via Web Worker.
- **Acessibilidade (WCAG AAA):** Contraste superior a 8:1 em todos os textos da marca, suporte a navegação completa por teclado, `prefers-reduced-motion` respeitado em todas as animações e alvos de toque $\ge 44 \times 44$ px.
