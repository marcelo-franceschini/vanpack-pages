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
