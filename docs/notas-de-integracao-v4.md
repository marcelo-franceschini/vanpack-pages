# Vanpack: notas de integração da v4

A v4 (pacote do Claude Design) foi integrada ao fluxo do repositório: `three` via npm, Vite, cena num
Web Worker (`OffscreenCanvas`) com fallback na thread principal, e a história ligada ao scroll com um
tour automático que rola a página sozinho.

## 1. Contrato do HTML

`index.html` é a única página. O que o JS usa (não renomear):

| Seletor                                                                            | Papel                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.story[data-tour="idle\|playing\|paused\|done"]`                                  | seção da história (altura 560 svh; o scroll útil é 460 svh; no celular, 400 svh e 300 svh)                                                                                                                                                                                                                                                                                                                                 |
| `.stage#stage` › `canvas#gl` + `.loader` + `.steps` + `#cue`                       | cena fixa na tela (`position: sticky`)                                                                                                                                                                                                                                                                                                                                                                                     |
| `.steps › .step › .wrap › .card`                                                   | 5 cartões, um por capítulo; o ativo tem `.on` e os demais `inert`                                                                                                                                                                                                                                                                                                                                                          |
| `#hdr` e `#hdr .btn`                                                               | cabeçalho; o botão pulsa (`.pulse`) quando o tour termina (no celular, com a barra à vista, ele sai e quem pulsa é a barra)                                                                                                                                                                                                                                                                                                |
| `#fab`                                                                             | botão do WhatsApp (div com `.fab-wa` e `.fab-tel`): no desktop só aparece depois do fim da história; em ≤ 768 px é uma barra de largura total com o telefone, à vista do 2º capítulo em diante (os cartões 2 a 5 reservam o espaço dela); some (`.away`) com `#orcamento` ≥ 30% visível                                                                                                                                    |
| `#zap-ajuda`                                                                       | folha "O WhatsApp não abriu?" (`src/handoff.js`): sobe se a página continua à vista 2,5 s depois do toque num botão do WhatsApp; copiar número, ligar e, em navegador embutido, como abrir no navegador                                                                                                                                                                                                                    |
| `a[data-cta][data-wa]`                                                             | botões do WhatsApp; o build troca `data-wa` por `href="https://wa.me/…"`                                                                                                                                                                                                                                                                                                                                                   |
| `#processo`, `#confianca`, `#produtos`, `#diferenciais`, `#clientes`, `#orcamento` | seções e âncoras do menu; as sem dado somem com os links (os 5 cartões de `#processo` nunca somem)                                                                                                                                                                                                                                                                                                                         |
| `<!--render:produtos\|diferenciais\|clientes-->`                                   | blocos gerados: produtos do `site.config.js` (`.model`), diferenciais do `.env` (`.pillar`) e clientes do `.env` com os depoimentos autorizados (`[data-carrossel]`, `.proof`)                                                                                                                                                                                                                                             |
| `[data-field="slogan\|razao\|cnpj\|endereco\|horario\|telefone\|mapa"]`            | rodapé: preenchido com o dado do `.env` ou removido do HTML quando não há dado                                                                                                                                                                                                                                                                                                                                             |
| `[data-need="chave outra"]`, `[data-need="!chave"]` e `{{variavel}}`               | o elemento sai se alguma chave estiver vazia; com `!`, sai se a chave tiver valor (o texto de quando falta o dado, nos cartões); `{{variavel}}` vazia fora de um `data-need` é erro de build                                                                                                                                                                                                                               |
| `[data-year]` e `[data-since]`                                                     | ano do © e anos de mercado: o build escreve o valor e o `main.js` o recalcula no navegador                                                                                                                                                                                                                                                                                                                                 |
| `a[data-contact="phone\|map"]`                                                     | links de contato: viram os eventos `phone_click` e `map_click`                                                                                                                                                                                                                                                                                                                                                             |
| `html[data-exp_quote_wizard="B"]` e `.wizard`                                      | experimento `quote_wizard` na variante B: o `#orcamento` troca o CTA final pelo assistente de 3 passos (montado por `src/wizard.js`); a A é a página como está                                                                                                                                                                                                                                                             |
| `.optional`                                                                        | trechos opcionais do hero (fim do eyebrow e do parágrafo); somem nos layouts compacto e de celular                                                                                                                                                                                                                                                                                                                         |
| `[data-carrossel]`                                                                 | carrossel de logos dos clientes (`src/carrossel.js`): a `.carrossel-janela[role="region"]` recebe foco (← → movem); o build gera só os itens originais e os controles com `hidden`; o JS copia os itens para o loop (`aria-hidden="true"` e `inert`), anima o `.carrossel-trilho` pela Web Animations API, mostra Pausar/Retomar (`aria-pressed`) e as setas, e escreve `data-estado` (`rodando`, `pausado` ou `estatico`) |
| `.model-3d[data-modelo][data-peca]`                                                | área 4:3 no topo de cada cartão de produto (`src/produtos/`): recebe o `<canvas role="img">` do 3D (classe `.pronto` no 1º quadro) ou a ilustração `public/produtos/<modelo>.svg`; arquitetura e mensagens do worker em `docs/produtos-3d.md`                                                                                                                                                                              |

Estados da página: `.stage.ready` (cena desenhada: o canvas entra por fade), `.stage.no-gl` (sem
WebGL: fica o fundo Papel, o símbolo e os cartões) e, enquanto o contexto está perdido, o `ready` sai
e volta quando ele é restaurado.

Não há barra de etapas nem botão de pausa: qualquer interação (roda, toque, clique, tecla ou scroll)
interrompe o tour, que nunca retoma sozinho.

## 2. Contrato da cena (`src/scene/index.js`)

```js
createScene(canvas, { dpr, mobile }) → {
  compile(): Promise<void>,   // shaders em paralelo + quadro de aquecimento (tudo à mostra)
  render(p),                  // desenha o quadro do progresso p (0…1); só chame quando p mudar
  resize(w, h),               // em CSS px; o enquadramento depende da proporção. Não desenha
  setPixelRatio(v),
  setShadows(on),             // para só a passada de sombra e o piso que a recebe; não recompila
  restore(),                  // contexto restaurado: reenvia as texturas desenhadas
  stats(),                    // { calls, triangles, geometries, textures } do último render
  dispose(),                  // libera tudo (verificado: 37 geometrias e 7 texturas → 0)
}
```

Sem `document`, `window` nem DOM. Texturas em `OffscreenCanvas` (sem ele, as peças ficam sem
impressão) e `DataTexture`; marca desenhada com `Path2D` a partir de `src/brand/marks.js` (gerado por
`scripts/brand.py`).

`mobile` (toque ou tela estreita) nasce sem sombra em tempo real. A cena é uma função pura de `p`: o
mesmo `p` dá o mesmo quadro.

## 3. Mensagens página ↔ render

| De → para       | Mensagem                        | Quando                                                                                         |
| --------------- | ------------------------------- | ---------------------------------------------------------------------------------------------- |
| página → render | `init { canvas, state }`        | ao criar o worker (o canvas é transferido)                                                     |
| página → render | `progress { value }`            | o scroll mudou o progresso; antes do "pronto" vale como posição inicial                        |
| página → render | `resize { width, height, dpr }` | a `.stage` mudou de tamanho ou a densidade da tela mudou                                       |
| página → render | `reduced { value }`             | `prefers-reduced-motion` mudou (sem suavização)                                                |
| render → página | `ready` / `error { message }`   | cena pronta / falha (a página cai para a thread principal e, se falhar de novo, para `.no-gl`) |
| render → página | `lost` / `restored`             | contexto WebGL perdido / restaurado                                                            |

O render só desenha quando o progresso suavizado muda (taxa de 6,3/s, igual em qualquer tela) e para
quando assenta. Qualidade adaptativa: a cada ~1 s de animação, mediana de quadro > 24 ms reduz a
resolução em 0,25 (até 1×) e depois para a sombra em tempo real, sem recompilar shaders.

## 4. Faixas de `p` (`PHASE` em `src/scene/constants.js`)

Centros fixos em 0, 0,25, 0,5, 0,75 e 1; cartão ativo = `round(p × 4)`; a câmera fica parada ~12%
em torno de cada centro.

| Cap.                | Faixa       | O que acontece                                                      | Quadro de pausa                      |
| ------------------- | ----------- | ------------------------------------------------------------------- | ------------------------------------ |
| 1 Medida            | 0 a 0,12    | pilha de chapas; a de cima entra na máquina                         | pilha + entrada da máquina           |
| 2 Impressão e corte | 0,12 a 0,38 | a chapa sai impressa, vincada e recortada; aparas no recolhimento   | chapa fora, aparas no ar (0,25)      |
| 3 Cola              | 0,38 a 0,60 | cola na aba, os painéis dobram, sai o tubo achatado                 | painel a 90°, fio de cola (0,5)      |
| 4 Caixa             | 0,60 a 0,82 | o tubo abre e gira na mesa, fecha e sobe na pilha do palete; cinta  | caixa aberta, marca de frente (0,75) |
| 5 Entrega           | 0,82 a 1    | o palete entra no baú, a porta fecha, o caminhão parte pela estrada | caminhão ao longe na estrada (1)     |

A máquina A (`src/scene/machine.js`, trechos em `MACHINE_A`) tem duas janelas na frente (+z) que
mostram os cilindros de impressão (com a luva Floresta) e de corte. Os cilindros giram junto com a
chapa, só enquanto ela passa pela máquina: giram só os marcadores (listras, luva, lâminas, cruz), em
5 malhas à parte, e o miolo fica na malha mesclada da fábrica. O trecho fechado entre as janelas
esconde a troca da chapa lisa pela peça "herói" (`PHASE.heroFromX`); um teste trava essa regra. A
lâmpada de sinalização no topo é amarela e vira verde (um verde de sinalização, mais claro que a Floresta) enquanto a peça cortada e impressa sai da
máquina (`lampMix`, função de `p`); é as duas únicas cores de acento da cena.

## 5. Tour automático (`src/tour.js`)

Começa no instante em que a cena fica pronta (sem espera), se a página está no topo, sem `#hash`, sem
`?tour=0`, sem movimento reduzido no sistema, com a aba visível e sem interação prévia. `?tour=1` força
o tour mesmo com movimento reduzido (para testar). Sem pausa inicial: o 1º capítulo já começa andando;
pausa de 2,5 s nos capítulos seguintes, 2 s entre capítulos (4 s do 1º ao 2º, onde a chapa entra na
máquina, e 2,5 s no último): ~18 s no total, com curva quadrática. Termina em `p = 1` (a página fica com o scroll no fim da história, **não** segue para
as seções seguintes) e o botão "Pedir orçamento" do cabeçalho pulsa. No F5 a página volta ao topo (o
navegador restauraria o scroll e o tour não começaria); voltar e avançar mantêm a posição. Quando o tour
não começa, o console diz o motivo (`[vanpack] autoplay não iniciou: …`).

## 6. Tokens

- Cores: Floresta `#14513A`, Carvão `#1B1A17`, Papel `#FBF8F2`, Kraft `#B78C5C` (só o material:
  papelão e a onda do divisor). Derivados só de Carvão/Papel/Floresta (mistura em oklab, calculada em
  hex no `:root` de `index.html`): `#0D3C2A`, `#454440` (texto secundário, 9,2:1 sobre Papel),
  `#ECE9E3`, `#DFDCD7`, `#D0CDC8`, `#2A5D47` (passos "Como pedir", 7,2:1 com texto Papel). Sem cor de
  acento (a exceção é o amarelo e o verde de sinalização da lâmpada da máquina, na ilustração da linha de produção).
- Tipografia: só Archivo (`public/fonts/archivo-latin.woff2`, 400 a 900), subconjunto do português (ASCII, Latin-1, pontuação geral, ↓ ↑ € ™ −; kerning e ligaduras ficam, frações não; 28 KB). Caractere fora dele (`Œ`, `ł`...) cai para a fonte do sistema. Tudo em `rem`.
- Alvos de toque ≥ 44 px; foco visível de 3 px; quebras: `(max-width: 760px), (max-aspect-ratio: 1/1)`
  = celular (cartões embaixo); `(max-height: 700px)` em paisagem = compacto.

## 7. Decisões

- **Sem barra de etapas e sem botão Pausar/Continuar/Rever** (decisão do dono). Fica a interrupção
  por qualquer interação. Isso não atende ao critério 2.2.2 do WCAG 2.2 para movimento automático
  acima de 5 s; o autoplay é omitido com `prefers-reduced-motion` e `?tour=0`.
- Botão flutuante: no desktop só depois da história. Até 768 px a barra aparece do 2º capítulo em diante
  (o cartão 1 tem o botão grande) e os cartões 2 a 5 reservam o espaço dela; antes ela só vinha depois
  da história porque cobria o cartão em telas estreitas.
- Variações do protótipo (adereços, câmera B, trilho vertical, `setOption`) saíram da produção.
- Sombra em tempo real só no desktop (a cena só projeta sombra no piso, a 16% de opacidade).
- `text-wrap: pretty` removido dos parágrafos (custava metade do layout inicial em CPU lenta).
- Slogan "Do projeto à entrega" no rodapé (manual §7); endereço, horário, CNPJ e mapa ficam ocultos
  até existirem em `site.config.js`/`.env`.
- **Autoplay sem espera, em qualquer tela** (decisão do dono): o tour nunca é desligado por largura de
  tela nem por Save-Data; só o movimento reduzido do sistema o desliga (acessibilidade).
- **Sem fotos** (decisão do dono): só SVG; a única foto real permitida seria a da fachada, e o dono prefere não usá-la. Depoimentos, logos e nota do Google só com autorização em `docs/provas/`.
- **Página sem e-mail, prazo, promessa de tempo de resposta nem texto de processo** (decisão do dono): os
  cartões falam do que importa a quem pede e a cena mostra a fabricação sem narrá-la. O
  `tests/conteudo.test.mjs` confere texto, atributos de acessibilidade, metas, JSON-LD e mensagens do
  WhatsApp. O 3D principal é travado por hash (`tests/trava-3d.test.mjs`).
- **Sem PWA** (decisão do dono): landing de um só objetivo, então não há manifest, service worker nem
  instalação como app. Ficam `theme-color`, favicons, `apple-touch-icon` e o `icon-512.png` (logo do
  JSON-LD). O `brand.test` confere que o Chrome acusa `no-manifest`.

## 8. Pendências do dono

- Confirmar o `vanpack-horizontal-negativo.svg` (horizontal em Papel sobre Floresta): o manual só traz
  o símbolo em negativo. É o horizontal oficial com a cor trocada, sem mais nada.
- Textos dos 5 cartões e dos diferenciais são rascunho: podem mudar depois da pesquisa de posicionamento.
- Dados institucionais (endereço, horário, CNPJ, mapa) e o número do WhatsApp (`VITE_WHATSAPP`).

## 9. Medidas

Como medir: `npm run audit:bundle`, `audit:scene`, `audit:runtime`, `audit:lighthouse` e `audit:capturas`
(Chrome do sistema; o WebGL roda por software, SwiftShader). "Antes" é a `master` anterior ou o
`scene.js` original do pacote v4.

| O que                                                                            | Antes                                 | Agora                                                |
| -------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------- |
| JS no caminho normal (página + worker), gzip                                     | 154,5 KB                              | **137,6 KB** (3,7 + 133,9; brotli do worker 110,3)   |
| JS se o worker falhar (+ thread principal), gzip                                 | 303,4 KB                              | 271,2 KB                                             |
| HTML + CSS inline, gzip                                                          | 11,2 KB                               | 7,1 KB (CSS inline 3,0 KB)                           |
| Draw calls desktop (p = 0 / .25 / .5 / .75 / 1)                                  | 14 / 23 / 24 / 32 / 20                | **12 / 22 / 23 / 31 / 19** (orçamento 90)            |
| Draw calls celular                                                               | 13 / 20 / 21 / 30 / 14                | **11 / 19 / 20 / 29 / 13** (orçamento 60)            |
| Triângulos (máx.)                                                                | 6,6 mil                               | 6,7 mil                                              |
| Lighthouse mobile (mediana de 5)                                                 | 97 · TBT 149 a 206 ms · LCP 1,5 s     | **100/100/100/100** · TBT 48 ms · LCP 1,36 s · CLS 0 |
| Lighthouse desktop                                                               | 100 / 100 / 92 / 100                  | **100/100/100/100** · TBT 0 · LCP 0,33 s             |
| Custo por quadro (SwiftShader, mediana de 5 rodadas × 5 quadros)                 | 1179 ms (desktop) · 424 ms (celular)  | −19% · −23%                                          |
| 1º quadro em que o herói aparece, versus o quadro seguinte                       | +680 ms (desktop) · +415 ms (celular) | +110 ms · +50 ms                                     |
| Cena pronta, rede 1,6 Mbps/150 ms e CPU 4×                                       | ~4,0 s                                | ~2,9 s                                               |
| Memória da GPU, estimada (texels × 4 bytes + mipmaps: mapa de sombra e texturas) | ~26 MB                                | ~7 MB                                                |
| `dispose()`                                                                      | sobravam recursos                     | 37 geometrias e 7 texturas → 0                       |

O que mudou e por quê (cada item é um commit `perf`, medido antes e depois, com diferença de pixels
contra o v4 original em 15 valores de `p`, desktop e celular):

- canvas e piso opacos (sem mistura de tela cheia nem textura de máscara) e sem o tracejado da estrada,
  que ficava sempre embaixo da estrada;
- sombra em mapa 1024 com recorte ajustado ao enquadramento e encaixado no texel;
- texturas de impressão, abas e logo do baú em resolução proporcional ao tamanho em tela;
- quadro de aquecimento antes do "pronto" (geometrias, texturas e variantes da passada de sombra);
- desligar a sombra não recompila shaders (1,9 s de travada no v4);
- chanfros gerados direto, sem `ExtrudeGeometry` (−8 KB gzip);
- `text-wrap: pretty` removido (layout inicial 230 → 144 ms em CPU 4×);
- o worker é criado antes de qualquer leitura de layout;
- aparas fora do quadro até p = 0,18; cartões opacos.

Na rolagem completa da história (14 s): 0 tarefas longas (> 50 ms) na thread principal com CPU
normal e 2 (61 e 64 ms, pintura e estilo) com CPU 4× mais lenta; com a página parada a cena não
desenha mais nenhum quadro.

**Não medido / limites**: GPU real (o Chrome de teste não tem GPU, então os quadros por segundo do
worker são um limite inferior e o custo por quadro é um indicador relativo), Safari/iOS e Firefox,
leitores de tela, redes e aparelhos reais. O Lighthouse usa a simulação padrão de rede e CPU.
