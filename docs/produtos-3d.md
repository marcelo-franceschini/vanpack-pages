# 3D de cada produto

Cada cartão de "O que fabricamos" tem no topo um 3D da peça, girando devagar em torno do eixo vertical, como a caixa na mesa giratória do capítulo 4 do 3D principal: mesma câmera de três quartos (`CAMERA_DIRECTION`, FOV 22), mesma luz, piso que esmaece no Papel, sombra falsa, papelão Kraft com a face interna mais clara e a borda com a onda do miolo (`edgeTexture`), marca Vanpack em Floresta impressa onde cabe. O 3D principal não muda: tudo fica em `src/produtos/` e reaproveita por importação o que `src/scene/` exporta.

Arquivos: `src/produtos/gatilho.js` (no JS inicial), `montar.js` (página), `produtos-worker.js` (worker), `cena.js` (renderer, luz, câmera e enquadramento), `papelao.js` (placa de papelão a partir de um contorno) e `modelos.js` (as 3 peças). Ilustrações do fallback: `public/produtos/<id>.svg`, geradas por `node scripts/produtos-svg.mjs`.

## Referência: o 3D dos produtos da Trombini

Consultada em 2026-10-20, só nos 3 produtos que a Vanpack vende. As páginas de corte e vinco e de divisórias não têm vídeo nem visualizador embutido: o botão "Ficha técnica" leva a um arquivo HTML (`Caixa-Corte-e-vinco.html` e `Divisoria-02-rasgos.html`) que é um visualizador WebGL com o modelo planificado ("Desdobrado"), o modelo montado ("Uso"), a animação de dobra e vistas de frente, lado e topo. A página das chapas não tem visualizador: a referência foi a foto do produto. Os visualizadores foram abertos no Chrome de teste e estudados por capturas de tela feitas fora do repositório. Nada foi baixado para o repositório nem extraído (malha, textura, imagem, script, logo, cores ou textos).

### Corte e vinco

- **Observado:** caixa tipo maleta (o modelo de e-commerce), baixa: largura, profundidade e altura em torno de 6 : 4 : 1. Planificada, é uma peça só: fundo no meio, frente e laterais que dobram para cima e voltam para dentro (paredes duplas), orelhas que entram nas laterais, tampa ligada ao fundo pela parede de trás, aba de fechamento na frente da tampa e orelhas laterais na tampa. Dois rasgos compridos na dobra da frente recebem as linguetas. Na animação a frente sobe primeiro, depois as laterais, e por último a tampa fecha girando na dobra de trás. Montada, mostra só a impressão, fechada.
- **Decisões da Vanpack:** a mesma família de caixa, mas aberta (tampa a 100°), para mostrar o que o corte especial faz: paredes da frente e dos lados duplas (a borda mostra as duas camadas), meia-lua de dedo na frente, dois rasgos de trava no fundo, tampa com orelhas laterais chanfradas e aba frontal com duas linguetas. Proporção mais alta (0,42 × 0,30 × 0,10 m) para o interior aparecer no cartão. Marca Vanpack na frente e na face de fora da tampa.

### Divisórias, tabuleiros e separadores

- **Observado:** grade 3 × 3 de 4 divisórias altas e retangulares, de cantos levemente arredondados, cada uma com 2 rasgos de meia altura ("02 rasgos"): um par com os rasgos por baixo, outro por cima. A montagem é por encaixe: o par de cima desce sobre o de baixo até as peças ficarem niveladas. Não há bandeja: a grade aparece sozinha.
- **Decisões da Vanpack:** a grade 3 × 3 com o mesmo encaixe de meia altura, dentro de um tabuleiro baixo (o produto inclui tabuleiros), com a marca na frente dele. Uma das divisórias de rasgo por baixo fica levantada, descendo para o encaixe: os rasgos das duas peças ficam à mostra. Divisórias mais baixas que as da referência (0,15 m num tabuleiro de 0,40 m) e de cantos chanfrados.

### Chapas de papelão ondulado

- **Observado (foto):** pilha de umas 10 chapas lisas, sem impressão, com a onda do miolo bem visível nas duas bordas à mostra; a pilha é um pouco irregular e a chapa de cima está deslocada.
- **Decisões da Vanpack:** pilha de 10 chapas com a borda ondulada (a mesma textura da pilha do capítulo 1), pequenos deslocamentos fixos entre as chapas e a de cima deslocada e girada. Espessura exagerada (2 cm), como no 3D principal, para a onda aparecer na tela. Sem impressão, como a chapa sai.

### O que ficou diferente da referência

- Nenhuma cor, logo, padrão de impressão ou texto da Trombini: Kraft liso, face interna mais clara e só a marca Vanpack.
- A caixa aparece aberta e girando, não fechada nem dobrando; a referência mostra a montagem passo a passo.
- As divisórias ganharam o tabuleiro e uma peça levantada; a referência é só a grade.
- Proporções próprias (caixa mais alta, divisórias mais baixas) e a pilha de chapas com a chapa de cima girada.
- Modelagem do zero, com as peças do próprio projeto: placas de papelão desenhadas por contorno (`papelao.js`) e a câmera, a luz e os materiais do 3D principal.

## Como funciona

- **Nada antes da hora.** `src/produtos/gatilho.js` é a única parte no JS inicial (cerca de 0,3 KB gzip): um IntersectionObserver na grade `.models` com margem de 300 px. Quando ela chega perto, ele desconecta e faz `import('./montar.js')`, um chunk próprio (`assets/montar-*.js`, 1,5 KB gzip). O three.js dos produtos vem num worker próprio (`assets/produtos-worker-*.js`, cerca de 133 KB gzip), baixado só nessa hora. O worker da história é travado e não pode ser compartilhado.
- **Um contexto WebGL só.** Com 3 colunas no desktop os 3 cartões ficam à vista ao mesmo tempo, e um contexto por cartão daria 3. Por isso um único `WebGLRenderer` num worker (`OffscreenCanvas`) desenha um modelo por vez e devolve um `ImageBitmap` por cartão. O `<canvas>` de cada cartão usa o contexto `bitmaprenderer` (não é WebGL). Total: no máximo 1 contexto além do da história.
- **Só perto e só à vista.** O modelo de um cartão é montado no worker quando o cartão chega a 300 px da tela e liberado (geometria, materiais e texturas) quando ele se afasta. Só os cartões à vista são desenhados, e com a aba oculta nada é desenhado. Longe de todos os cartões, o worker libera tudo (`dispose`, `forceContextLoss`) e é encerrado; ao voltar, um worker novo é criado.
- **Ritmo.** 30 quadros por segundo, uma volta a cada 20 s (tempo real, igual em qualquer tela), cada cartão com uma fase um pouco diferente. O worker espera a página receber um quadro antes de desenhar o seguinte, então nada se acumula num aparelho lento.
- **Desempenho.** Densidade até 1,5× no celular e 2× no desktop, sem sombra em tempo real (uma sombra falsa por modelo), de 4 a 8 draw calls por modelo (orçamento: 60; `npm run audit:produtos`).
- **Contexto perdido.** O worker para e avisa; o último quadro continua no cartão. Restaurado, as texturas são reenviadas e o giro volta.
- **Sem condição para o 3D.** Sem `Worker`, `OffscreenCanvas` ou `bitmaprenderer`, sem WebGL no worker, com economia de dados, rede 2g/3g (quando o navegador informa) ou até 2 GB de memória, cada cartão mostra a ilustração em SVG da peça no mesmo espaço 4:3 reservado. O motivo vai para o console (`[vanpack] produtos: …`). As ilustrações são projeções das mesmas peças, só com os tons do material da cena, sem texto e sem marca.
- **Movimento reduzido.** O modelo aparece parado numa pose de três quartos e o rótulo perde o "girando".
- **Acessibilidade.** O canvas tem `role="img"` e `aria-label` ("Modelo 3D de caixa com corte e vinco girando" etc., com a `peca` de cada produto em `site.config.js`) e não recebe foco; a ilustração tem `alt`. O único controle do cartão continua sendo o botão de orçamento.

### Mensagens página × worker

| sentido         | mensagem                                     | quando                                                   |
| --------------- | -------------------------------------------- | -------------------------------------------------------- |
| página → worker | `init { reduced, hidden }`                   | ao criar o worker                                        |
| página → worker | `add { id, modelo, width, height, visible }` | o cartão chegou a 300 px da tela: monta o modelo         |
| página → worker | `remove { id }`                              | o cartão se afastou: libera o modelo                     |
| página → worker | `resize { id, width, height }`               | o cartão mudou de tamanho (pixels do aparelho)           |
| página → worker | `visible { id, on }`                         | o cartão entrou ou saiu da tela                          |
| página → worker | `pause` / `resume`                           | aba oculta / de volta                                    |
| página → worker | `reduced { value }`                          | o sistema mudou o movimento reduzido                     |
| página → worker | `ack`                                        | a página aplicou o último quadro                         |
| página → worker | `dispose`                                    | nenhum cartão perto: libera tudo e perde o contexto      |
| worker → página | `ready` / `error { message }`                | o renderer subiu / não subiu (a página cai para o SVG)   |
| worker → página | `frame { frames: [{ id, bitmap }] }`         | um quadro de cada cartão à vista                         |
| worker → página | `lost` / `restored`                          | contexto WebGL perdido / restaurado                      |
| worker → página | `disposed`                                   | tudo liberado; a página encerra o worker                 |
| worker → página | `stats`                                      | só no build de auditoria: draw calls e o que está na GPU |

No build de auditoria a página expõe `window.__audit.produtos` (quadros, contadores por cartão, memória, workers criados, `loseContext()` e `askMemory()`), usado por `tests/produtos.test.mjs` e `scripts/audit/produtos-stats.mjs`.
