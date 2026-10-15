# Vanpack — notas de integração da v4

A v4 (pacote do Claude Design) foi integrada ao fluxo do repositório: `three` via npm, Vite, cena num
Web Worker (`OffscreenCanvas`) com fallback na thread principal, e a história ligada ao scroll com um
tour automático que rola a página sozinho.

## 1. Contrato do HTML

`index.html` é a única página. O que o JS usa (não renomear):

| Seletor                                                      | Papel                                                                          |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `.story[data-tour="idle\|playing\|paused\|done"]`            | seção da história (altura 560 svh; o scroll útil é 460 svh)                    |
| `.stage#stage` › `canvas#gl` + `.loader` + `.steps` + `#cue` | cena fixa na tela (`position: sticky`)                                         |
| `.steps › .step › .wrap › .card`                             | 5 cartões, um por capítulo; o ativo tem `.on` e os demais `inert`              |
| `#hdr` e `#hdr .btn`                                         | cabeçalho; o botão pulsa (`.pulse`) quando o tour termina                      |
| `#fab`                                                       | botão flutuante do WhatsApp; só aparece depois do fim da história              |
| `a[data-cta][data-wa]`                                       | botões do WhatsApp; o build troca `data-wa` por `href="https://wa.me/…"`       |
| `#tour-start` (`data-tour-ui`)                               | "Ver como fazemos": toca o tour (ou, sem tour, leva ao capítulo 2)             |
| `#processo`, `#diferenciais`, `#orcamento`                   | âncoras do menu                                                                |
| `[data-field="slogan\|endereco\|horario\|cnpj\|mapa"]`       | rodapé: preenchido por `site.config.js` ou removido do HTML quando não há dado |

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

| Cap.                | Faixa     | O que acontece                                                      | Quadro de pausa                      |
| ------------------- | --------- | ------------------------------------------------------------------- | ------------------------------------ |
| 1 Medida            | 0–0,12    | pilha de chapas; a de cima entra na máquina                         | pilha + entrada da máquina           |
| 2 Impressão e corte | 0,12–0,38 | a chapa sai impressa, vincada e recortada; aparas no recolhimento   | chapa fora, aparas no ar (0,25)      |
| 3 Cola              | 0,38–0,60 | cola na aba, os painéis dobram, sai o tubo achatado                 | painel a 90°, fio de cola (0,5)      |
| 4 Caixa             | 0,60–0,82 | o tubo abre e gira na mesa, fecha e sobe na pilha do palete; cinta  | caixa aberta, marca de frente (0,75) |
| 5 Entrega           | 0,82–1    | o palete entra no baú, a porta fecha, o caminhão parte pela estrada | caminhão ao longe na estrada (1)     |

## 5. Tour automático (`src/tour.js`)

Começa 0,8 s depois de a cena ficar pronta, se a página está no topo, sem `#hash`, sem `?tour=0`, sem
movimento reduzido, com a aba visível e sem interação prévia. Pausa de 4,5 s no 1º capítulo e de 5 s
nos seguintes; 3 s entre capítulos (3,5 s no último): ~32 s no total. Termina em `p = 1` (a página
fica com o scroll no fim da história, **não** segue para as seções seguintes) e o botão
"Pedir orçamento" do cabeçalho pulsa.

## 6. Tokens

- Cores: Floresta `#14513A`, Carvão `#1B1A17`, Papel `#FBF8F2`, Kraft `#B78C5C` (só o material:
  papelão e a onda do divisor). Derivados só de Carvão/Papel/Floresta (mistura em oklab, calculada em
  hex no `:root` de `index.html`): `#0D3C2A`, `#454440` (texto secundário, 9,2:1 sobre Papel),
  `#ECE9E3`, `#DFDCD7`, `#D0CDC8`, `#2A5D47` (passos "Como pedir", 7,2:1 com texto Papel). Sem cor de
  acento.
- Tipografia: só Archivo (`public/fonts/archivo-latin.woff2`, 400–900). Tudo em `rem`.
- Alvos de toque ≥ 44 px; foco visível de 3 px; quebras: `(max-width: 760px), (max-aspect-ratio: 1/1)`
  = celular (cartões embaixo); `(max-height: 700px)` em paisagem = compacto.

## 7. Decisões

- **Sem barra de etapas e sem botão Pausar/Continuar/Rever** (decisão do dono). Fica a interrupção
  por qualquer interação. Isso não atende ao critério 2.2.2 do WCAG 2.2 para movimento automático
  acima de 5 s; o autoplay é omitido com `prefers-reduced-motion` e `?tour=0`.
- Botão flutuante só depois da história: no último capítulo ele cobria o cartão em telas estreitas.
- Variações do protótipo (adereços, câmera B, trilho vertical, `setOption`) saíram da produção.
- Sombra em tempo real só no desktop (a cena só projeta sombra no piso, a 16% de opacidade).
- `text-wrap: pretty` removido dos parágrafos (custava metade do layout inicial em CPU lenta).
- Slogan "Do projeto à entrega" no rodapé (manual §7); endereço, horário, CNPJ e mapa ficam ocultos
  até existirem em `site.config.js`/`.env`.

## 8. Pendências do dono

- Confirmar o `vanpack-horizontal-negativo.svg` (horizontal em Papel sobre Floresta): o manual só traz
  o símbolo em negativo. É o horizontal oficial com a cor trocada, sem mais nada.
- Textos dos cartões 2–5 e das mensagens do WhatsApp são rascunho.
- Dados institucionais (endereço, horário, CNPJ, mapa) e o número do WhatsApp (`VITE_WHATSAPP`).
- `assets/brand/*.svg` (fontes da marca) carregam metadados C2PA de ferramenta de IA; os de
  `public/brand/` são limpos.

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
| Lighthouse mobile (mediana de 5)                                                 | 97 · TBT 149–206 ms · LCP 1,5 s       | **100/100/100/100** · TBT 48 ms · LCP 1,36 s · CLS 0 |
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
