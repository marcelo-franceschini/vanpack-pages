# VanPack — landing page

Página da VanPack Embalagens (caixas de papelão personalizadas, Santo André-SP) com a animação 3D da
linha de produção guiada pelo scroll. A única ação da página é pedir orçamento pelo WhatsApp.

## Comandos

Requer Node 22.12+.

```bash
npm install
npm run dev       # servidor local com recarga
npm run build     # gera dist/
npm run preview   # serve o dist/ localmente
npm run lint      # ESLint + Prettier (o CI roda o mesmo)
npm run format    # formata tudo com Prettier
```

## Configuração (`.env`)

- `VITE_WHATSAPP`: número que recebe os pedidos, `55` + DDD + número (ex.: `5511912345678`).
  Vazio, o WhatsApp abre com a mensagem pronta e a pessoa escolhe o contato. O build recusa números
  em formato inválido.
- `VITE_SITE_URL`: endereço público do site, usado em canonical, Open Graph e JSON-LD.

A mensagem pronta de cada botão fica no atributo `data-wa` em `index.html`. No build ela vira um link
`https://wa.me/<número>?text=…`, que funciona mesmo sem JavaScript. Cada clique gera
`{ event: 'whatsapp_click', cta }` no `dataLayer`, pronto para GTM/GA4.

## Publicação

Cada push na `master` roda `.github/workflows/deploy.yml`: lint, build e deploy no GitHub Pages. Em
**Settings → Pages**, a fonte precisa ser **GitHub Actions**.

## Estrutura

```
index.html                 página, CSS inline, meta tags, Open Graph e JSON-LD
src/main.js                scroll, cartões, header, botão flutuante e dataLayer
src/render/stage.js        põe o 3D num Web Worker (OffscreenCanvas) ou, sem suporte, na thread principal
src/render/worker.js       entrada do worker
src/render/controller.js   loop sob demanda, suavização por tempo, qualidade adaptativa, perda de contexto
src/scene/                 cena 3D: medidas, texturas, materiais, máquinas, chapa, caminhão e linha do tempo
public/fonts/              Archivo e JetBrains Mono (licença OFL)
public/og.jpg              imagem de compartilhamento (captura do hero em 1200×630)
vite.config.js             links do WhatsApp, JSON-LD e CSP gerados no build
```

## Performance

- O three.js, a montagem da cena, a compilação dos shaders e cada frame rodam num Web Worker: a thread
  principal fica livre para o scroll e os cliques.
- O three.js vem do npm com tree-shaking e minificação, servido do mesmo domínio (~150 kB gzip).
- Cada frame é desenhado só quando o progresso muda. Peças estáticas são mescladas por material, e
  rolos e rodas só giram as partes em que a rotação aparece.
- Em aparelhos que não passam de ~40 fps, a resolução cai e, se preciso, as sombras em tempo real
  são desligadas.
- As fontes são servidas do próprio site, com preload. A Archivo foi reduzida ao eixo de largura
  100–110 (de 90 kB para 54 kB) com
  `fonttools varLib.instancer archivo-latin-wdth-normal.woff2 wdth=100:110 wght=400:800`, a partir de
  `@fontsource-variable/archivo` 5.3.0.
