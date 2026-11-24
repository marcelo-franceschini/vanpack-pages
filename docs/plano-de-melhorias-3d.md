# Plano de melhorias do 3D

Relatório da revisão completa de novembro de 2026, só da parte 3D, escrito para quem vai executá-lo sem o
contexto da conversa em que foi feito. O resto do projeto está em
[`plano-de-melhorias.md`](plano-de-melhorias.md).

"3D" aqui é: `src/scene/` (a história da fábrica), `src/render/` (o loop de render), `src/produtos/` (o 3D
dos 4 produtos), a câmera, a trava por hash e os documentos dessas partes.

## 0. Leia primeiro: o que este relatório é e o que não é

**A auditoria dedicada ao 3D por agentes não rodou.** Ela estava planejada e falhou por inteiro no limite de
uso de 5 horas, sem devolver nada. Tudo abaixo vem de leitura minha e de medições. Cada achado traz uma
marca de como foi conferido:

- **[medido]**: rodei e vi o número (navegador, `npm run audit:*`, `cmp` de arquivos construídos).
- **[calculado]**: conta analítica com o código do projeto (a câmera importada em Node), sem navegador.
- **[lido]**: li o código e concluí; não executei.
- **[não verificado]**: suspeita ou dependência de aparelho que não existe nesta máquina.

O que li inteiro: `src/scene/*` (todos), `src/render/*`, `src/produtos/*` (menos `papelao.js`, de que li só as
70 primeiras de 288 linhas), `docs/produtos-3d.md`, `tests/trava-3d.test.mjs`, `tests/paridade.test.mjs`.
Li em parte: `tests/produtos.test.mjs` (as seções de rótulos e densidade), `tests/scene.test.mjs` (os nomes
dos testes e o da câmera) e `build/three-compartilhado.js` (o cabeçalho). Não conferi geometria por
geometria os 4 modelos de `modelos.js` (li o arquivo, mas não procurei defeito de forma) nem os scripts de
`scripts/audit/` além das linhas dos limites de draw calls.

### Onde trabalhar

- Branch `feat/revisao-layout-e-codigo` (ela já tem 3 commits sobre a master, um deles de tipos do 3D:
  seção 2). Continue nela. **Não dê push e não abra pull request**: o dono valida antes.
- Um assunto por commit, no padrão do [`CONTRIBUTING.md`](../CONTRIBUTING.md): Conventional Commits em
  português, com o porquê no corpo. Sem linhas de atribuição.
- Leia o [`CLAUDE.md`](../CLAUDE.md): nunca abra o `index.html` inteiro; busque o trecho.
- Textos, comentários e commits em português do Brasil, **sem travessão longo nem meio travessão** (o
  `tests/docs.test.mjs` confere `docs/`).

### Resumo dos itens

| Item | O que é                                                     | Tipo                 | Mexe na trava? | Prioridade                |
| ---- | ----------------------------------------------------------- | -------------------- | -------------- | ------------------------- |
| 3    | Enquadramento da abertura (título maior, 1000 px, celular)  | decisão do dono      | sim            | baixa, se o título fica   |
| 4.1  | `canvasTexture` exportada e reaproveitada                   | refatoração          | sim            | baixa                     |
| 4.2  | Laço das letras de "SUA MARCA" numa função só               | refatoração          | sim            | baixa                     |
| 4.3  | Teste que trava as cópias de luz, FOV e critério de celular | teste novo           | não            | média                     |
| 5.1  | Cartão do 3D lido duas vezes pelo leitor de tela            | acessibilidade       | não            | média                     |
| 5.2  | Rótulo do cartão não acompanha o movimento reduzido         | acessibilidade (bug) | não            | média                     |
| 5.3  | `docs/produtos-3d.md` defasado em 7 pontos                  | documentação         | não            | média                     |
| 5.4  | Densidade do 3D dos produtos com duas chaves iguais         | simplificação        | não            | baixa                     |
| 6    | A trava por hash e as mudanças só de comentário             | decisão do dono      | sim            | baixa                     |
| 7    | O que nunca foi medido (GPU real, Safari, Firefox)          | medição              | não            | alta, precisa de aparelho |
| 8    | Pendências antigas que são do dono                          | decisão              | não            | (dele)                    |

## 1. Regras do 3D

- **O 3D principal é travado por hash.** `src/scene/`, `src/render/` e `tests/scene.test.mjs` (15 arquivos)
  são conferidos por `tests/trava-3d.test.mjs` contra `tests/fixtures/3d-lock.json`. O
  [`CONTRIBUTING.md`](../CONTRIBUTING.md) diz que mexer neles é decisão do dono. Este relatório é a
  autorização para os itens que o dono escolher fazer; os itens que mexem na trava dizem isso.
  - Para refazer a trava depois de uma mudança **de propósito**: apague `tests/fixtures/3d-lock.json`, rode
    `node --test tests/trava-3d.test.mjs` na sua máquina (sem o arquivo, a 1ª execução o recria; no CI, sem
    o arquivo, falha) e versione o arquivo novo **no mesmo commit** da mudança, dizendo no corpo que o 3D foi
    mexido de propósito.
  - A conferência só olha os arquivos que estão no fixture. Arquivo novo em `src/scene/` ou `src/render/`
    **não** é coberto até a trava ser refeita.
- **O 3D dos produtos (`src/produtos/`) não é travado.** Vale a mesma cautela, mas sem fixture.
- **Os tetos de bytes só descem** (`tests/orcamento.test.mjs`). Nunca suba um teto nem afrouxe um teste.
  Código em `src/scene/` e `src/render/` entra em **dois** arquivos construídos: o worker da história (conta
  no JS inicial) e o `controller` (render de reserva, com teto próprio). Cada byte novo na cena custa nos
  dois. Folgas medidas no Node 26: worker 188 bytes, controller 114, `produtos-worker` 113, `montar` 118. O
  JS inicial tem **cerca de 95 bytes de folga real** no Node 24 do CI (259 no Node 26 menos cerca de 160).
  Mudar só números (constantes de câmera) custa de 0 a poucos bytes: meça.
- **Orçamento de draw calls**: história até 90 no desktop e 60 no celular (`npm run audit:scene`), produtos
  até 60 por modelo (`npm run audit:produtos`). Medido hoje: história de 19 a 31 no desktop e de 13 a 29 no
  celular; produtos de 4 a 8. Há muita folga.
- **Paridade visual.** O job `paridade` do CI compara pixel a pixel o site do PR com o da master. Qualquer
  mudança de enquadramento ou de desenho reprova de propósito: o PR precisa do rótulo **`muda-visual`** e de
  explicação na descrição (quem abre o PR é o dono).
- **Decisões do dono que não se reabrem**: só as cores Floresta, Carvão, Papel e Kraft (a lâmpada amarela e
  verde da máquina A é a única exceção, e está comentada em `src/scene/constants.js`); sem fotos; o tour
  automático toca sozinho ao abrir e não tem botão de pausa; sem PWA; o 3D principal é travado.
- **Material novo.** O three.js do projeto é aparado: só vão os shaders de Basic, Lambert e sombra (o resto
  é cortado em `build/three-compartilhado.js`). Um material de outro tipo derruba o build com a explicação;
  não o contorne, fale com o dono.

### Como validar qualquer mudança no 3D

```bash
npm run lint && npm run typecheck
npm run build && npm run build:audit
node --test tests/scene.test.mjs tests/trava-3d.test.mjs tests/three-compartilhado.test.mjs \
  tests/orcamento.test.mjs tests/produtos.test.mjs tests/layout.test.mjs tests/robustness.test.mjs
npm run audit:scene && npm run audit:produtos
npm run audit:paridade          # compara com a master; só deve diferir onde você quis mudar
```

E prove o que não mudou comparando o arquivo construído com o da master (seção 2).

## 2. Ponto de partida e prova de que nada mudou

O commit `e747779` (já na branch) corrigiu os 48 erros de tipo do 3D só com JSDoc e um `export`:

- `src/scene/geometry.js`: `@returns {[number, number][]}` no contorno octogonal;
- `src/scene/math.js`: tipos de `ramp` e `lin`;
- `src/scene/machine.js`: JSDoc de `windowBay`;
- `src/scene/timeline.js`: tipo de `hero`;
- `src/render/controller.js`: typedef `ControllerMessage`; `src/render/stage.js`: `send` tipado;
- `src/scene/textures.js`: `export const GLYPHS` (as letras da marca, antes copiadas em `marca.js`);
- `src/produtos/marca.js` importa `GLYPHS`; `src/produtos/cena.js` com a ordem dos imports corrigida;
- `package.json`: `typecheck` virou `tsc -p jsconfig.json && tsc -p jsconfig.pagina.json`, sem o filtro
  que escondia os erros do 3D; a trava foi refeita.

**Prova de que o desenho não mudou [medido]**: construí a master numa pasta à parte e comparei com o `dist/`
desta branch, arquivo a arquivo, com `cmp`:

| Arquivo (`assets/`) | Master (bytes gzip) | Branch (bytes gzip) | Resultado                                       |
| ------------------- | ------------------: | ------------------: | ----------------------------------------------- |
| `worker-*`          |              11.690 |              11.690 | idêntico byte a byte                            |
| `controller-*`      |              11.764 |              11.764 | idêntico byte a byte                            |
| `three-*`           |             114.256 |             114.256 | idêntico byte a byte                            |
| `produtos-worker-*` |               7.580 |               7.567 | muda: `marca.js` agora reaproveita `GLYPHS`     |
| `montar-*`          |               1.929 |               1.930 | muda só o nome com hash do worker citado nele   |
| `index-*`           |               7.941 |               7.939 | muda só o nome com hash do `montar` citado nele |

O worker da história, o render de reserva e o three.js saem iguais: a cena não mudou nem um byte.

Receita para repetir a prova em qualquer commit (a comparação vale para qualquer ref):

```bash
BASE=$(mktemp -d)                                   # fora do repositório
git archive master | tar -x -C "$BASE"
ln -s "$PWD/node_modules" "$BASE/node_modules"
(cd "$BASE" && npx vite build --outDir dist-base)
npm run build
for n in worker controller three; do
  cmp "$BASE"/dist-base/assets/$n-*.js dist/assets/$n-*.js && echo "$n idêntico"
done
```

Rode a partir da raiz do repositório. O nome de cada arquivo leva um hash do conteúdo, e o `cmp` compara o
conteúdo, não o nome. Se o `worker` ou o `controller` saírem diferentes depois de um refator que devia ser
neutro, **pare e descubra por quê** antes de seguir.

## 3. Enquadramento da abertura contra os cartões

Este é o item mais delicado do relatório. Ele só vale a pena se o dono quiser um título maior na abertura
(a sugestão de 48 para 56 a 64 px da revisão). Se o título fica como está, a única parte necessária é a do
relatório geral (item 3.1: cartão da abertura com largura fluida e modo compacto só quando precisa), que
resolve o cartão cobrindo a máquina **sem tocar no 3D**.

### 3.1 Como a câmera decide o enquadramento

Em `src/scene/camera.js` e `src/scene/constants.js` (busque pelos nomes):

- `FOV_LANDSCAPE = 22`, `FOV_PORTRAIT = 27`, `NEAR = 2.5` (o `near` em 2,5 é de propósito: dá precisão ao
  buffer de profundidade e acabou com o pisca de peças a poucos milímetros uma da outra; commit `e0bfbd5`).
- A direção da câmera é fixa: `CAMERA_DIRECTION = [-0.62, 0.55, 0.82]` (três quartos).
- `resize(width, height)`: em paisagem, `camera.setViewOffset(width, height, -width * (width < 1000 ? 0.25 :
0.2), -height * 0.03, width, height)` empurra a cena para a direita (para sobrar a esquerda aos
  cartões), e `view.fw = width < 1000 ? 0.5 : 0.6`, `view.fh = 0.8` dizem que fração da tela a cena útil
  ocupa. Em retrato: `setViewOffset(..., 0, height * 0.125, ...)`, `fw = 1`, `fh = 0.46`.
- `place(p)`: interpola as chaves `CAMERA_KEYS` (5 chaves, uma por capítulo, p = 0, 0,25, 0,5, 0,75 e 1) com
  `CAMERA_PAUSE = 0.12` (a câmera fica parada no miolo de cada trecho). Cada chave dá o alvo `at` e a
  largura e altura úteis em metros (`w`, `h`). A distância é a maior entre a que cabe a altura e a que cabe
  a largura: `max(h / (2 tan(fov/2) fh), w / (2 tan(fov/2) aspecto fw))`.
- A chave da abertura (p = 0): `at: [-6.0, 0.72, 0]`, `w: 7.4`, `h: 4.0`; em retrato, `w: 3.5`, `h: 2.8`.
- O commit do dono `27400cb` ("a câmera da abertura mostra a máquina inteira") foi quem chegou a esses
  números. **A intenção dele era a máquina A inteira à vista.** Qualquer proposta abaixo que encolha a
  máquina vai contra isso e precisa do "sim" dele.

### 3.2 O que existe hoje [calculado com a câmera do projeto]

Abertura (p = 0), paisagem, com o cartão de 44rem de hoje. "Folga" é a borda esquerda do alimentador (a peça
mais à esquerda da cena) menos a borda direita do cartão: negativa quer dizer que o cartão cobre a peça.

| Tela      | Borda direita do cartão | Alimentador começa em | Folga | Máquina A (x) |
| --------- | ----------------------: | --------------------: | ----: | ------------- |
| 1280×595  |                     755 |                   718 |   -37 | 893 a 1236    |
| 1280×720  |                     755 |                   717 |   -38 | 893 a 1239    |
| 1366×643  |                     759 |                   766 |    +7 | 953 a 1319    |
| 1366×768  |                     759 |                   765 |    +6 | 952 a 1323    |
| 1440×900  |                     762 |                   807 |   +45 | 1004 a 1396   |
| 1536×864  |                     813 |                   861 |   +48 | 1071 a 1487   |
| 1920×1080 |                    1019 |                  1076 |   +57 | 1339 a 1859   |
| 2560×1440 |                    1350 |                  1434 |   +84 | 1785 a 2479   |

Leitura: a máquina A nunca é cortada à direita; o problema só existe nos notebooks de 1280 a 1366 px, onde o
cartão cobre o alimentador (e em tela compacta, abaixo). O cartão de 44rem **não é** necessário para o
título de 48 px: a receita do relatório geral (item 3.1) o deixa fluido e a folga fica positiva em todas as
telas acima.

Celular deitado e janelas compactas (cartão de 44rem hoje contra o de 32rem da receita do relatório geral):

| Tela     | Alimentador | Máquina A | Hoje: cartão até (cobre da cena) | Com 32rem: cartão até (cobre) |
| -------- | ----------- | --------- | -------------------------------- | ----------------------------- |
| 844×390  | 535 a 665   | 631 a 822 | 738 (203 px)                     | 546 (11 px)                   |
| 932×430  | 591 a 734   | 697 a 907 | 741 (150 px)                     | 549 (0)                       |
| 924×540  | 585 a 728   | 691 a 901 | 741 (156 px)                     | 549 (0)                       |
| 1024×690 | 573 a 763   | 714 a 994 | 745 (172 px)                     | 553 (0)                       |

Retrato (p = 0), `y` de cima para baixo:

| Tela     | Alimentador (y) | Topo do cartão (medido no navegador) | O cartão cobre      |
| -------- | --------------- | ------------------------------------ | ------------------- |
| 390×844  | 265 a 481       | 460                                  | 21 px da base       |
| 360×640  | 192 a 394       | 263                                  | 131 de 202 px       |
| 768×1024 | 306 a 636       | 694                                  | nada (58 px livres) |

Em 360×640 a cena fica metade atrás do cartão. Pela conta de `place()` em retrato, em celulares (proporção
menor que cerca de 0,575) quem manda na distância é a **largura** útil (3,5 m), não a altura: mudar
`view.fh` não adianta. Mostrar mais da cena acima do cartão exigiria encolhê-la (aumentar a largura útil) ou
subi-la (o deslocamento vertical, `height * 0.125`), e a máquina A já está perto do topo (y = 68). **Não
é um defeito**: é o que cabe num celular curto. Fica como observação para o dono decidir se vale encolher.

Os demais capítulos em 1440×900 (cartão de 30rem, borda direita em 538), para referência:

| p    | Alimentador (x)  | Máquina A (x)    | Máquina B (x) |
| ---- | ---------------- | ---------------- | ------------- |
| 0,25 | 73 a 540         | 468 a 1176       | 1158 a 1611   |
| 0,5  | fora, à esquerda | -475 a 651       | 735 a 1379    |
| 0,75 | fora, à esquerda | fora, à esquerda | -128 a 784    |
| 1    | -234 a -46       | -52 a 277        | 329 a 565     |

O caminhão e o palete não estão nesta tabela. Só projetei o alimentador e as duas máquinas, e só a
posição horizontal delas: não conferi o que cada capítulo mostra por trás do cartão.

### 3.3 Por que o título maior não cabe por CSS

O cartão da abertura tem a largura do título: `13,167 × tamanho do título + 4,5rem` (item 3.1 do relatório
geral; a 48 px são 704 px). A 1440 px o alimentador começa 45 px depois do cartão. Um título de 52 px
(+8%) já invade em 7 px; de 56 px (+17%), em 60 px; de 64 px (+33%), em 165 px. Para crescer, a cena tem que
andar para a direita ou diminuir. Isso é câmera, ou seja, 3D.

### 3.4 As opções, com a conta [calculado]

Cada linha muda só a chave de p = 0 (ou o deslocamento) em paisagem; o retrato não muda. Os números são a
folga (borda do alimentador menos borda do cartão) com o cartão fluido do relatório geral e o título em
**52 px** e em **56 px**. A última coluna é o tamanho da máquina A contra hoje.

| Opção                                 | 1280×720 (52 / 56) | 1440×900 (52 / 56) | 1920×1080 (52 / 56) | Máquina A |
| ------------------------------------- | -----------------: | -----------------: | ------------------: | --------: |
| Hoje (título em 48 px: +21, +45, +57) |          -27 / -75 |           -7 / -60 |            -2 / -61 |      100% |
| Deslocamento de 20% para 22%          |           -1 / -49 |           21 / -32 |            36 / -23 |      100% |
| `w` 8,2 e alvo x -6,35                |           17 / -31 |           42 / -11 |              64 / 5 |       90% |
| `w` 8,6 e alvo x -6,5                 |           34 / -14 |             61 / 8 |             90 / 31 |       86% |
| `w` 9,4 e alvo x -6,9                 |            70 / 22 |           102 / 49 |            144 / 85 |       78% |
| `w` 10,6 e alvo x -7,4                |           108 / 60 |           144 / 91 |           200 / 141 |       69% |

Notas sobre a tabela:

- O **deslocamento de 22%** é a mudança mais barata (um número em `camera.js`: `0.2` vira `0.22`). Move a
  cena 29 px para a direita em 1440, mas deixa só **15 px** entre a máquina A e a borda direita da tela
  (em 24% ela já é cortada). Não resolve 56 px em tela nenhuma, e deixa a máquina colada na borda.
- As linhas com `w` maior **encolhem a máquina** (`w` é a largura útil em metros: quanto maior, mais longe a
  câmera). É o preço do título maior, e é o que o commit `27400cb` evitou.
- A coluna de 1280×720 é sempre a pior. Se o título maior valer só de 1366 px para cima, dá para usar
  uma largura útil menor com uma regra por largura de tela, ao custo de um salto entre faixas (item 3.6).
- A sugestão de folga mínima de **24 px** é minha, não do projeto.
- Nenhuma opção foi aplicada nem vista no navegador: é conta de projeção. Quem aplicar precisa olhar.

### 3.5 Recomendação

1. **Se o dono não quer o título maior: não mexa no 3D neste item.** Aplique só o item 3.1 do relatório geral.
2. **Se quer 52 px (+8%)**: `w: 8.2` e `at: [-6.35, 0.72, 0]` na chave de p = 0 de `CAMERA_KEYS` (máquina
   a 90%, folga de 17 a 64 px). É a mudança menor que ainda dá folga em 1280.
3. **Se quer 56 px ou mais**: só com `w` de 9,4 ou mais (máquina a 78% ou menos). O dono tem que ver e
   aceitar a máquina menor, porque contraria a intenção do `27400cb`.
4. Uma opção robusta (a página mede o cartão e manda a largura ocupada ao render, que reserva exatamente
   esse espaço) **não cabe no orçamento de bytes**: acrescentar uma mensagem no `stage.js` e no
   `controller.js` custa nos dois arquivos, e o JS inicial tem cerca de 95 bytes de folga real. Não recomendo.

### 3.6 Receita (se o dono aprovar uma opção)

1. `src/scene/constants.js`, `CAMERA_KEYS`, primeira chave (a de `p: 0`): troque `at: [-6.0, 0.72, 0]` e
   `w: 7.4` pelos valores da opção. **Não mexa** na chave `portrait` dessa mesma entrada.
2. Rode `node medir-enquadramento.mjs` (script do apêndice A) com os números novos e confira a folga das
   telas da seção 3.2, e rode `npm run audit:scene` (os draw calls não mudam).
3. Olhe a abertura **e o início do tour**: a chave de p = 0 também governa o movimento até p = 0,25 (a câmera
   interpola as duas chaves, parada nos primeiros 12% do trecho). Capture p = 0, 0,03, 0,06, 0,12 e 0,25 em
   1280×720, 1440×900 e 1920×1080 e compare com a master.
4. Refaça a trava (seção 1). O worker e o `controller` mudam alguns bytes: meça com o script da seção 2 e
   confira os tetos (`worker` 188 bytes de folga, `controller` 114, JS inicial cerca de 95 no Node 24).
5. O teste `tests/scene.test.mjs` ("câmera: uma chave por capítulo...") só exige 5 chaves em p = 0, 0,25,
   0,5, 0,75 e 1 e `w`, `h` positivos: passa. **Esse arquivo é travado**: não o edite.
6. `npm run audit:paridade`: vai apontar as telas de abertura de propósito. O PR leva `muda-visual`.
7. Se o título passar de 48 px, a mudança de CSS (tamanho do título e largura do cartão) é do relatório geral,
   item 3.1, e tem de entrar no mesmo PR.

### 3.7 Salto da câmera em 1000 px [calculado]

`camera.js` troca de enquadramento em `width < 1000` (deslocamento 25% e `fw` 0,5 abaixo; 20% e 0,6 acima).
Na conta, em 999×700 a máquina A ocupa x de 747 a 976 (229 px, 23% da tela); em 1000×700, de 697 a 971
(273 px, 27%). A máquina **cresce 19% e anda 50 px para a esquerda** ao cruzar os 1000 px. Quem redimensiona a
janela do navegador vê a cena pular; em aparelho só afeta quem está logo abaixo de 1000 px de largura.

Prioridade baixa. Se for mexer, interpole as duas faixas em vez de trocar (um fator `t` entre 800 e 1100 px),
junto com qualquer outra mudança de enquadramento, porque o `audit:paridade` vai apontar as telas de
paisagem abaixo de 1000 px de qualquer jeito.

## 4. Saúde do código do 3D

Todas as mudanças desta seção são refatorações de comportamento nulo. Prove com o `cmp` da seção 2.

### 4.1 `canvasTexture` copiada três vezes

`src/scene/textures.js` tem `canvasTexture(width, height, scale, draw)` (busque pelo nome; é privada). O mesmo
miolo (`OffscreenCanvas` ou `null`, `getContext('2d')`, `g.scale`, `CanvasTexture`, `colorSpace =
SRGBColorSpace`, `anisotropy = 4`, `try/catch`) existe também em `src/produtos/marca.js`
(`suaMarcaTexture`) e em `src/produtos/papel.js` (`papelTexture`).

**Como fazer.**

1. `src/scene/textures.js`: troque `function canvasTexture(` por `export function canvasTexture(`.
   **Só a palavra `export`**: o lembrete é a lição do `e747779`, onde exportar a luz inteira custou 58 bytes
   gzip no worker da história, que está no teto. Uma função que já é usada dentro do arquivo não deve custar
   nada, mas **confirme com o `cmp` da seção 2**: se o `worker` ou o `controller` mudarem, desfaça.
2. `src/produtos/marca.js`: `suaMarcaTexture` vira `canvasTexture(WIDTH, HEIGHT, SCALE, (g) => draw(g))`
   (o `draw` atual já faz o seu próprio `g.scale(unit, unit)` depois do `g.scale(SCALE, SCALE)`, que passa a
   ser feito pelo `canvasTexture`: a ordem das escalas é a mesma). Apague o resto da função.
3. `src/produtos/papel.js`: `papelTexture(color)` vira `canvasTexture(SIZE, SIZE, 1, (g) => { ...desenho... })`
   e, depois, `if (texture) texture.wrapS = texture.wrapT = RepeatWrapping`. O `canvasTexture` já devolve
   `null` sem `OffscreenCanvas`, como as duas funções fazem hoje.

**Ganho esperado**: o `produtos-worker` encolhe (não medido; ele tem 113 bytes de folga). Nada muda no
desenho: confira com `npm run audit:paridade` (a seção dos produtos tem o 3D de cada produto) e
`node --test tests/produtos.test.mjs`.

### 4.2 O laço que desenha as letras de "SUA MARCA" existe duas vezes

`drawPrint` (em `src/scene/textures.js`) e `draw` (em `src/produtos/marca.js`) têm as mesmas constantes
(`glyphH = 64`, `glyphW = 50`, `stroke = 14`, `gap = 22`, `space = 50`, `word = 'SUA MARCA'`) e o mesmo
laço sobre `GLYPHS`. O `e747779` unificou só a tabela de letras.

**Como fazer.** Em `textures.js`, exporte uma função `drawWord(g, x, y)` que desenha a palavra a partir do
canto superior esquerdo `(x, y)` e devolva a largura total; use-a nos dois lugares (`drawPrint` calcula o `x`
para centrar; `marca.js` já tem `x` e `y` próprios). Preserve `lineJoin = 'miter'`, `lineCap = 'square'` e
`lineWidth = stroke` ao entrar e ao sair.

**Risco**: baixo valor (cerca de 15 linhas) contra um arquivo travado e uma impressão que aparece no
desenho principal. **Só faça junto do 4.1**, para refazer a trava uma vez só, e confira que a caixa
impressa no capítulo 2 não muda (`audit:paridade`, quadros p = 0,25 e 0,5). Se aparecer qualquer diferença de
pixel, desfaça: não vale o risco.

### 4.3 Cópias de propósito sem nada que as trave [validado: o teste abaixo passa hoje]

Há três valores copiados entre arquivos, com um comentário dizendo "o mesmo de":

- a luz (`SKY`, `GROUND`, `SUN`, `SUN_OFFSET` e as intensidades 2,0 e 2,1) em `src/produtos/cena.js`, copiada
  de `src/scene/index.js`. Exportar custa 58 bytes no worker da história [medido no `e747779`]: **mantenha
  copiada**;
- o `FOV = 22` de `src/produtos/cena.js`, igual a `FOV_LANDSCAPE` de `src/scene/camera.js`;
- o critério de celular `'(max-width: 760px), (pointer: coarse)'` em `src/render/stage.js` e em
  `src/produtos/montar.js` (e o `@media (max-width: 760px)` do `index.html`).

Se alguém mexer num lado, o outro fica errado sem erro nenhum. Um teste que **lê os arquivos** custa zero
byte e não toca na trava. Crie `tests/copias-3d.test.mjs` (arquivo novo entra sozinho nas partes do CI, por
`tests/partes.test.mjs`; acrescente uma linha ao README na lista de testes):

```js
// As cópias de propósito entre o 3D principal e o 3D dos produtos não podem se afastar sem aviso.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const grab = (source, pattern, what) => {
  const found = source.match(pattern);
  assert.ok(found, `${what}: o trecho mudou de forma, ajuste este teste`);
  return found.slice(1);
};

test('a luz e o FOV do 3D dos produtos são os do 3D principal (cópias de propósito, ver cena.js)', () => {
  const scene = read('src/scene/index.js');
  const camera = read('src/scene/camera.js');
  const cena = read('src/produtos/cena.js');

  const [sky, ground, fill] = grab(
    scene,
    /new HemisphereLight\((0x\w+), (0x\w+), ([\d.]+)\)/,
    'luz de céu',
  );
  const [sunColor, sunPower] = grab(scene, /new DirectionalLight\((0x\w+), ([\d.]+)\)/, 'sol');
  const [offset] = grab(scene, /const SUN_OFFSET = new Vector3\(([^)]+)\)/, 'posição do sol');
  const [fov] = grab(camera, /const FOV_LANDSCAPE = (\d+);/, 'FOV');

  assert.equal(Number(grab(cena, /const SKY = (0x\w+);/, 'SKY')[0]), Number(sky));
  assert.equal(Number(grab(cena, /const GROUND = (0x\w+);/, 'GROUND')[0]), Number(ground));
  assert.equal(Number(grab(cena, /const SUN = (0x\w+);/, 'SUN')[0]), Number(sunColor));
  assert.equal(grab(cena, /const SUN_OFFSET = new Vector3\(([^)]+)\)/, 'SUN_OFFSET')[0], offset);
  assert.equal(Number(grab(cena, /const FOV = (\d+);/, 'FOV')[0]), Number(fov));
  assert.equal(
    Number(grab(cena, /new HemisphereLight\(SKY, GROUND, ([\d.]+)\)/, 'céu')[0]),
    Number(fill),
  );
  assert.equal(
    Number(grab(cena, /new DirectionalLight\(SUN, ([\d.]+)\)/, 'sol')[0]),
    Number(sunPower),
  );
});

test('o critério de "celular" do 3D principal e o dos produtos são o mesmo', () => {
  const stage = grab(read('src/render/stage.js'), /const MOBILE = '([^']+)'/, 'stage.js')[0];
  const montar = grab(read('src/produtos/montar.js'), /const MOBILE = '([^']+)'/, 'montar.js')[0];
  assert.equal(montar, stage);
});
```

Rodei os dois testes contra o código de hoje e passam. Se o item 5.4 for aplicado (a constante `MOBILE`
sai de `montar.js`), apague o segundo teste. Rode o Prettier no arquivo (o `npm run lint` confere).

## 5. 3D dos produtos

Tudo em `src/produtos/` e fora da trava. Medido hoje (`npm run audit:produtos`, desktop e celular): de 4 a 8
draw calls por modelo (caixa normal 7, corte e vinco 8, divisórias 7, chapas 4), de 300 a 1040 triângulos;
rolar para dentro e para fora 3 vezes deixa 3 modelos, 17 geometrias, 12 texturas e 5 programas, sempre os
mesmos (sem vazamento), e só 1 worker criado na visita.

Tamanho do canvas de cada cartão [medido, `?tour=0`, 2º cartão encostado no pé da tela]:

| Tela (DPR)    | Cartão 1 (destaque) | Cartões 2 a 4 | Observação                                                       |
| ------------- | ------------------- | ------------- | ---------------------------------------------------------------- |
| 1440×900 (1)  | 722×541             | 364×273       | os 4 à vista ao mesmo tempo (cerca de 690 mil pixels por quadro) |
| 1920×1080 (1) | 793×595             | 402×301       | idem                                                             |
| 1366×640 (1)  | 683×512             | 342×256       | idem                                                             |
| 768×1024 (2)  | 565×424             | 443×332       | densidade 1,5 sobre o tamanho em CSS                             |
| 390×844 (3)   | 453×340             | 453×340       | só 1 ou 2 à vista; o 4º nem montou                               |

### 5.1 O cartão é lido duas vezes pelo leitor de tela [lido, não testado com leitor de tela]

`src/produtos/montar.js`: a área `.model-3d` recebe `tabIndex = 0`, `role="group"` e `aria-label` com
"Modelo 3D de X girando. Use as setas do teclado para girar." (busque `Use as setas do teclado`), e o
`<canvas>` filho recebe `role="img"` e `aria-label="Modelo 3D de X girando"` (busque `setAttribute('role',
'img')`). No modo de navegação por elementos, o leitor lê o grupo e depois a imagem: o mesmo texto duas
vezes.

**Como fazer.** O nome fica só na área (que é o elemento focável). O canvas vira decorativo.

1. Em `approach(card)`, onde o canvas é criado, troque as linhas de `role="img"` e `aria-label` por
   `card.canvas.setAttribute('aria-hidden', 'true');`.
2. Crie uma função única para o nome, perto de `label`:

   ```js
   const describe = (card) =>
     `Modelo 3D de ${card.area.dataset.peca}${reducedQuery.matches ? '' : ' girando'}. Use as setas do teclado para girar.`;
   ```

   e use-a no `area.setAttribute('aria-label', describe(card))` do laço dos cartões. A função `label`
   antiga deixa de ser necessária.

### 5.2 O rótulo do cartão não acompanha o movimento reduzido [lido]

Mesmo trecho: quando a pessoa liga o movimento reduzido com a página aberta, o `reducedQuery.addEventListener
('change', ...)` (no fim de `montarProdutos`) atualiza o `aria-label` do **canvas** (`card.canvas?.
setAttribute('aria-label', label(card))`), mas o da **área** foi escrito uma vez só, na criação, e continua
dizendo "girando" depois de a peça parar. E antes de o cartão chegar perto o canvas nem existe, então o nome
da área é o único.

**Como fazer.** No mesmo `change`, depois de mandar `reduced` ao worker, atualize a área:

```js
reducedQuery.addEventListener('change', () => {
  send({ type: 'reduced', value: reducedQuery.matches });
  if (failed) return; // sem 3D os atributos já foram tirados (fail())
  for (const card of cards) card.area.setAttribute('aria-label', describe(card));
});
```

O `if (failed)` importa: `fail()` remove `tabindex`, `role` e `aria-label` das áreas, e um nome solto numa
`div` sem papel seria pior que nenhum.

**Testes que mudam** (`tests/produtos.test.mjs`):

- Nas linhas do teste "monta, não fica em branco, gira e tem descrição": hoje lê `role`, `aria-label` e
  `tabIndex` do `canvas` (`role === 'img'`, rótulo `/^Modelo 3D de .+ girando$/`, `tabIndex === -1`). Passa a
  ler a **área**: `role === 'group'`, `tabIndex === 0`, rótulo
  `/^Modelo 3D de .+ girando\. Use as setas do teclado para girar\.$/`, e o canvas com
  `aria-hidden === 'true'`.
- No teste de movimento reduzido (`'Modelo 3D de caixa normal fechada'` lido do canvas): passa a ler da
  área, com o texto `'Modelo 3D de caixa normal fechada. Use as setas do teclado para girar.'`.
- **Teste novo**: abrir a página sem movimento reduzido, mostrar os produtos, chamar
  `page.emulateMedia({ reducedMotion: 'reduce' })` e conferir que o nome da área perde o "girando".
- Confira `node --test tests/axe.test.mjs tests/a11y.test.mjs tests/foco.test.mjs` (o foco global é
  `:focus-visible` em `src/base.css`, então a área já mostra o contorno).

### 5.3 `docs/produtos-3d.md` não bate com o código

Corrija cada ponto (busque o texto citado):

| Trecho do documento                                                                                                                                                                                     | O que diz                                                                     | O que é                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Lista de arquivos (2º parágrafo)                                                                                                                                                                        | `gatilho`, `montar`, `produtos-worker`, `cena`, `papelao`, `marca`, `modelos` | falta `papel.js` (a textura do papel, `papelTexture`)                                                                                                                                            |
| "Caixa normal", decisões: "7 draw calls e 284 triângulos"                                                                                                                                               | 284 triângulos                                                                | 7 draw calls e **476** triângulos [medido]                                                                                                                                                       |
| "Corte e vinco", decisões: "meia-lua de dedo na frente"                                                                                                                                                 | tem meia-lua de dedo                                                          | o modelo não tem: a busca por `meia-lua` e `dedo` em `src/produtos/` não acha nada [lido]. Tire do texto, ou o dono decide acrescentar o recorte                                                 |
| "Corte e vinco", decisões: "Marca Vanpack na frente e na face de fora da tampa"                                                                                                                         | Marca Vanpack                                                                 | a marca é a genérica "SUA MARCA" (e a seção "O que ficou diferente" diz "nunca a Vanpack")                                                                                                       |
| "Como funciona", 1º item: "three.js (cerca de 119 KB gzip...)", `montar` "1,5 KB", worker "cerca de 7 KB"                                                                                               | 119, 1,5 e 7 KB                                                               | hoje: three.js 111,6 KB (114.256 bytes), `montar` 1,9 KB (1.930), `produtos-worker` 7,4 KB (7.567) [medido]                                                                                      |
| "Acessibilidade": "O canvas tem `role="img"` e `aria-label` (... com a `peca` de cada produto em `site.config.js`) e não recebe foco... O único controle do cartão continua sendo o botão de orçamento" | só o canvas, `peca` em `site.config.js`, só o botão                           | a `peca` vem de `content/produtos.yaml`; a **área** `.model-3d` recebe foco (`tabindex 0`, `role="group"`) e gira com as setas, e também com o arrasto do ponteiro. Reescreva depois do item 5.1 |
| Tabela "Mensagens página × worker"                                                                                                                                                                      | sem `grab`, `drag` e `nudge`                                                  | o worker aceita `grab { id, on }`, `drag { id, turn }` e `nudge { id }` (o comentário do topo de `produtos-worker.js` os lista)                                                                  |

O resto do documento confere com o código (por exemplo, "de 4 a 8 draw calls por modelo" bate com o medido).
Rode `node --test tests/docs.test.mjs` (o texto não pode ter travessão).

### 5.4 Duas chaves iguais na densidade [lido]

`src/produtos/montar.js`: `MAX_DENSITY = { desktop: 1.5, mobile: 1.5 }` e `matchMedia(MOBILE).matches ?
... : ...` escolhem entre dois valores iguais, de propósito (o comentário explica: com a grade 2×2 até 4
cartões ficam à vista e a 2× custariam 3,6 vezes mais pixels). A constante `MOBILE` só serve a essa conta.

**Como fazer** (só se o dono não pretende voltar a separar os dois): `const MAX_DENSITY = 1.5;`,
`const density = Math.min(devicePixelRatio || 1, MAX_DENSITY);` e apague a constante `MOBILE` do arquivo. O
teste "no desktop o canvas desenha no máximo 1,5 pixel por pixel da tela" continua valendo. Ganha alguns
bytes no `montar` (meça), e tira uma das duas cópias do critério de celular (item 4.3).

## 6. A trava por hash e as mudanças só de comentário

O `tests/trava-3d.test.mjs` compara o sha256 do **arquivo inteiro**. Por isso o `e747779`, que só mexeu em
JSDoc, precisou refazer o fixture, mesmo sem mudar o desenho. Duas observações:

- A trava é um **alarme**, não uma barreira: quem refaz o fixture no mesmo PR a faz passar. O que protege é o
  diff de `tests/fixtures/3d-lock.json` aparecer na revisão do dono.
- Mudança só de comentário e de formatação trava como mudança de desenho.

| Opção                                                                | Prós                                                     | Contras                                                                                                |
| -------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **A. Manter** (recomendada)                                          | simples; ruído só quando o 3D é mexido                   | JSDoc e comentário também refazem o fixture                                                            |
| B. Hash do arquivo sem comentários (tirar comentários antes do hash) | JSDoc e comentário passam sem refazer a trava            | um removedor de comentários dentro do teste é código a manter e pode errar com strings que contêm `//` |
| C. Hash do arquivo construído (o chunk do worker e o do controller)  | prova o que de fato roda; ignora comentário e formatação | muda a cada atualização do Vite ou do three.js, então a trava reclama de um bump que não é do 3D       |

Recomendação: **A**, mais o script de comparação da seção 2 como `scripts/comparar-build.mjs <ref>`
(constrói a ref numa pasta temporária e compara os chunks), para provar "o desenho não mudou" na descrição do
PR em vez de depender só do fixture. **Precisa do "sim" do dono** se for virar script versionado.

## 7. O que nunca foi medido, e o roteiro para medir

Todos os testes do projeto rodam no Chrome do sistema com WebGL **por software** (SwiftShader), sem GPU. Os
tempos que aparecem nos testes e nas auditorias não dizem nada sobre aparelho real.

| O que                                                     | Por que importa                                                                                                                                                                                    | Como medir                                                                                                                                                                                                                          |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Quadros por segundo da história em celular de verdade** | a qualidade adaptativa (`SLOW_FRAME_MS = 24`, passo de 0,25 na densidade, depois sem sombra) foi calibrada por raciocínio                                                                          | um Android de entrada e um iPhone: `npm run build && npm run preview -- --host`, abra pelo IP da rede, role a história e olhe o painel de desempenho remoto do Chrome; anote quadros por segundo por capítulo e se a densidade caiu |
| **Safari no iPhone**                                      | `OffscreenCanvas` com WebGL em worker, `svh`, `:has()` e rolagem programada; não há WebKit nesta máquina. O código tem queda para a thread principal (`stage.js`, `fallback()`) e avisa no console | iPhone com o Mac por inspeção remota. Confira: a cena aparece; se aparecer `Render em worker indisponível`, o render caiu para a thread principal (aceitável); os produtos montam; a perda de contexto volta                        |
| **Firefox**                                               | worker com WebGL e `ImageBitmapRenderingContext` (3D dos produtos); não foi aberto                                                                                                                 | `firefox` abrindo o `preview`: cena, 3D dos produtos, console sem erro                                                                                                                                                              |
| **Tempo até a cena aparecer, em produção**                | o LCP não enxerga `<canvas>`; o resumo da visita leva `scene` em ms (0 = sem 3D)                                                                                                                   | depois do go-live, no Umami, o evento `visit_summary` com a propriedade `scene`: percentis por aparelho. 0 em muitas visitas quer dizer sem WebGL ou falha                                                                          |
| **Perda de contexto no celular real**                     | só é testada com `audit-lose` (200 ms); no aparelho real o sistema derruba por memória                                                                                                             | com a página aberta e o 3D dos produtos visível, alterne apps e volte; o giro tem que voltar                                                                                                                                        |
| **Rede lenta e `Save-Data`**                              | o 3D principal não consulta `saveData`, `deviceMemory` nem a rede (os produtos consultam)                                                                                                          | `npm run audit:carga` e o DevTools com "Slow 3G"; ligar `Save-Data` e ver o que baixa                                                                                                                                               |

Nada disso tem como passar no CI: é medida com aparelho. Registre os números numa nota curta em `docs/` (sem
travessão) e só então decida o item 8.

## 8. Pendências antigas que são decisão do dono

Não faça nenhum destes sem o "sim" dele; este relatório só põe os fatos.

1. **Botão de pausa do 3D dos produtos.** Cada peça gira em volta do eixo para sempre (uma volta a cada 20 s,
   30 quadros por segundo). O WCAG 2.2.2 pede um controle para pausar movimento automático acima de 5 s. O
   dono já aceitou o risco para o carrossel de clientes; para o 3D dos produtos a pergunta continua em
   aberto. Hoje o movimento reduzido do sistema é respeitado (a peça para numa pose).
2. **Economia de dados e memória no 3D principal.** O 3D dos produtos cai para a ilustração SVG com
   `Save-Data`, rede 2g/3g ou até 2 GB de memória; o 3D principal baixa o three.js (111,6 KB) e o worker
   sempre. Decidir se o principal também deve ter uma versão sem 3D (o fundo Papel com o símbolo já existe
   quando não há WebGL).
3. **Trava por hash para o 3D dos produtos** (`src/produtos/`). Hoje só o 3D principal é travado.
4. **Título maior na abertura** (seção 3) e a máquina menor que ele custa.
5. **Meia-lua de dedo na caixa de corte e vinco** (item 5.3): tirar do texto ou acrescentar ao modelo.
6. **Salto em 1000 px** (item 3.7): vale corrigir sozinho ou só junto de outra mudança de enquadramento.

## 9. Roteiro de execução

Faça nesta ordem. Depois de cada commit: `npm run lint && npm run typecheck && npm run build` e os testes
indicados. Se um teste não listado falhar, pare e entenda a causa.

| #   | Commit                                                                                          | Itens    | Testes a rodar                                                               |
| --- | ----------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------- |
| 1   | `test(3d): luz, FOV e critério de celular do 3D dos produtos não se afastam do principal`       | 4.3      | o arquivo novo, `partes`, `docs` (README)                                    |
| 2   | `fix(a11y): o cartão do 3D tem um nome só e ele acompanha o movimento reduzido`                 | 5.1, 5.2 | `produtos`, `axe`, `a11y`, `foco`                                            |
| 3   | `docs(3d): produtos-3d.md igual ao código`                                                      | 5.3      | `docs`                                                                       |
| 4   | `refactor(produtos): densidade única e sem o critério de celular repetido` (só se o dono topar) | 5.4, 4.3 | `produtos`, `orcamento`                                                      |
| 5   | `refactor(3d): textura em canvas e a palavra da marca numa função só` (mexe na trava)           | 4.1, 4.2 | `scene`, `trava-3d`, `produtos`, `orcamento`, `paridade`, o `cmp` da seção 2 |
| 6   | `feat(cena): enquadramento da abertura para o título maior` (só com a opção aprovada)           | 3        | `layout`, `tour`, `scene`, `trava-3d`, `orcamento`, `paridade`               |

O commit 6 depende do item 3.1 do relatório geral estar feito e muda a aparência: o PR leva `muda-visual`.
Os commits 1 a 3 não mexem na trava e não mudam a aparência.

### Antes de entregar

- [ ] `npm test` inteiro verde.
- [ ] `cmp` da seção 2: `worker`, `controller` e `three` idênticos à master (ou diferença explicada e
      aprovada, nos commits 5 e 6).
- [ ] Bytes medidos e comparados com os tetos; nada estourou; medido também no Node 24.
- [ ] `npm run audit:scene` e `npm run audit:produtos` dentro do orçamento de draw calls.
- [ ] `tests/fixtures/3d-lock.json` versionado no mesmo commit de quem mexeu no 3D principal.
- [ ] `git status` limpo e nenhum push.
- [ ] Na mensagem ao dono: a lista de commits, o que mudou de aparência e o que ficou esperando decisão
      dele (seção 8). Quem abre o PR é ele, com `muda-visual` quando for o caso.

## Apêndice A: script de medição do enquadramento

Salve na raiz do repositório como `medir-enquadramento.mjs` (não versione) e rode `node
medir-enquadramento.mjs [p]`, com `p` entre 0 e 1 (padrão 0). Projeta as caixas que envolvem o alimentador e
as máquinas A e B com a câmera do projeto e imprime a faixa de pixels de cada uma. Conferido: dá 717 a 954
para o alimentador em 1280×720 e 807 a 1073 em 1440×900, como na seção 3.2.

```js
import { Vector3 } from 'three';
import { createCameraRig } from './src/scene/camera.js';

const caixa = (x0, x1, y0, y1, z0, z1) => {
  const pontos = [];
  for (const x of [x0, x1])
    for (const y of [y0, y1]) for (const z of [z0, z1]) pontos.push([x, y, z]);
  return pontos;
};
// caixas que envolvem cada peça (medidas de src/scene/factory.js e machine.js)
const PECAS = {
  alimentador: [
    ...caixa(-7.4, -6.0, 0, 0.1, -1.05, 0.91),
    ...caixa(-7.35, -6.05, 0.1, 0.53, -1.0, 0.86),
    ...caixa(-7.05, -6.35, 0.53, 1.0, -0.87, 0.73),
  ],
  maquinaA: [
    ...caixa(-5.25, -2.45, 0, 1.36, -1.05, 1.05),
    ...caixa(-5.06, -4.94, 1.36, 1.76, 0.82, 0.94),
  ],
  maquinaB: [
    ...caixa(-1.05, 1.45, 0, 0.34, -0.67, 0.67),
    ...caixa(-0.2, 0.7, 0.34, 1.38, -1.1, -0.7),
  ],
};
const ponto = new Vector3();
const p = Number(process.argv[2] ?? 0);
for (const [largura, altura] of [
  [1280, 720],
  [1366, 768],
  [1440, 900],
  [1920, 1080],
  [390, 844],
]) {
  const rig = createCameraRig();
  rig.resize(largura, altura);
  rig.place(p);
  rig.camera.updateMatrixWorld(true);
  const linha = Object.entries(PECAS).map(([nome, pontos]) => {
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const [x, y, z] of pontos) {
      ponto.set(x, y, z).project(rig.camera);
      const sx = ((ponto.x + 1) / 2) * largura;
      const sy = ((1 - ponto.y) / 2) * altura;
      x0 = Math.min(x0, sx);
      x1 = Math.max(x1, sx);
      y0 = Math.min(y0, sy);
      y1 = Math.max(y1, sy);
    }
    return `${nome} x ${Math.round(x0)} a ${Math.round(x1)} y ${Math.round(y0)} a ${Math.round(y1)}`;
  });
  console.log(`${largura}x${altura}: ${linha.join(' | ')}`);
}
```

Para a conta de "e se" da seção 3.4 sem editar o arquivo travado: importe `CAMERA` de
`./src/scene/constants.js` e altere a chave em memória antes de criar o rig, por exemplo
`CAMERA.landscape[0].w = 8.2; CAMERA.landscape[0].x = -6.35;`. Conferido: dá x de 1032 a 1385 para o corpo
da máquina A em 1440×900, como na tabela. O deslocamento de 20% está dentro de `resize()` e só se varia
copiando a função para o script.
