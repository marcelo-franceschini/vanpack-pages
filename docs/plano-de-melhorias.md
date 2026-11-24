# Plano de melhorias: tudo menos o 3D

Relatório da revisão completa de novembro de 2026, escrito para ser executado por outro modelo, sem o
contexto da conversa em que foi feito. Cada item diz o problema, a evidência medida, onde fica, como
fazer, os testes que quebram e como validar.

O que toca o 3D (`src/scene/`, `src/render/`, `src/produtos/`, a câmera e a trava por hash) está em
[`plano-de-melhorias-3d.md`](plano-de-melhorias-3d.md) e **não deve ser feito a partir deste arquivo**.

## 0. Como usar este documento

### Onde trabalhar

- Branch `feat/revisao-layout-e-codigo`. Ela já tem 3 commits sobre a master (seção 2). Continue nela.
- **Não dê push e não abra pull request**: o dono valida no navegador dele antes. Commits locais só.
- Um assunto por commit, no padrão do [`CONTRIBUTING.md`](../CONTRIBUTING.md): Conventional Commits em
  português, com o porquê no corpo. Sem linhas de atribuição.

### Regras que valem para tudo

- Leia o [`CLAUDE.md`](../CLAUDE.md): nunca abra o `index.html` inteiro (são cerca de 1.900 linhas, quase
  tudo CSS). Busque o seletor ou o texto que este relatório cita e leia só aquele trecho.
- Textos, comentários, commits e documentos em português do Brasil, **sem travessão longo nem meio
  travessão** (o build recusa em `content/` e o `tests/docs.test.mjs` confere `docs/`, README e guias).
- Os números de linha deste relatório são do commit `e747779`. Eles mudam a cada edição: confie no
  seletor e no texto de busca, não no número.
- Não mexa em `src/scene/`, `src/render/`, `src/produtos/`, `tests/scene.test.mjs` nem em
  `tests/fixtures/3d-lock.json`.
- Os tetos de bytes de `tests/orcamento.test.mjs` só descem. Nunca suba um teto nem afrouxe um teste
  para ele passar. Se uma mudança deste relatório estourar um teto, pare e avise o dono.
- Texto de negócio mora em `content/`, nunca no `index.html` nem no código (`tests/template.test.mjs`).
- Nada de número, prazo ou alegação inventados. Onde este relatório diz "precisa do dono", não escreva
  o conteúdo por conta própria.

### Decisões do dono que não se reabrem

Sem fotos (só SVG). Tour automático sem botão de pausa. Carrossel sem controles. Sem PWA. Sem e-mail,
prazo nem promessa de tempo de resposta. Só as cores Floresta, Carvão, Papel e Kraft e a fonte Archivo.
CSS embutido no HTML. `.env` versionado (só tem variáveis públicas). O 3D principal travado por hash.

### Itens que são correção e itens que são decisão

- **Seção 3 (layout)**: defeitos medidos. Pode aplicar.
- **Seção 4 (visual)**: mudam a aparência por opinião de design. Cada um precisa do "sim" do dono antes.
  Faça um commit por item, para ele poder recusar um sem perder os outros.
- **Seções 5 a 9**: código, testes, documentação e ajustes pequenos. Pode aplicar, salvo onde diz
  "precisa do dono".

### O que "validado na cópia" quer dizer

As receitas das seções 3 e 4 foram aplicadas todas juntas numa cópia do projeto fora do repositório,
construídas, medidas no navegador em 18 tamanhos de tela e passadas pela suíte inteira. Resultado: 362 de
371 testes passam; os 9 que falham são exatamente os que este relatório manda atualizar. Onde um item
diz "não validado", a receita é só de leitura do código.

### Comandos

```bash
npm run dev                         # http://localhost:5173
npm run build && npm run preview    # http://localhost:4173, o build de verdade
npm run lint && npm run typecheck   # uns 10 s
node --test tests/layout.test.mjs   # um arquivo de teste (precisa de npm run build antes)
npm test                            # a suíte inteira, uns 10 min: rode antes de entregar
```

## 1. Linha de base medida

Medido no commit `e747779`, com Node 26 nesta máquina. O CI usa Node 24 (`.nvmrc`), cujo gzip sai um
pouco maior: cerca de 160 bytes a mais no JS inicial.

### Bytes (gzip nível 9, como o teste mede)

O teste compara `bytes <= teto * 1024`.

| Arquivo                             | Hoje (bytes) | Teto (KB) | Teto (bytes) | Folga no Node 26 |
| ----------------------------------- | -----------: | --------: | -----------: | ---------------: |
| `index` (script da página)          |        7.939 |       7,9 |        8.089 |              150 |
| `worker` (cena da história)         |       11.690 |      11,6 |       11.878 |              188 |
| `three` (three.js compartilhado)    |      114.256 |     111,9 |      114.585 |              329 |
| `controller` (render de reserva)    |       11.764 |      11,6 |       11.878 |              114 |
| `produtos-worker`                   |        7.567 |       7,5 |        7.680 |              113 |
| `montar`                            |        1.930 |       2,0 |        2.048 |              118 |
| `index.html`                        |       11.264 |      11,4 |       11.673 |              409 |
| `politica-de-privacidade.html`      |        3.388 |       3,6 |        3.686 |              298 |
| `404.html`                          |        1.153 |       2,0 |        2.048 |              895 |
| JS inicial (index + worker + three) |      133.885 |     131,0 |      134.144 |              259 |

- **O JS inicial tem cerca de 95 bytes de folga real** (259 no Node 26 menos os cerca de 160 do Node 24).
  Qualquer JavaScript novo no script da página precisa ser mínimo.
- O `index.html` com o conteúdo no limite dos schemas pesa cerca de 0,3 KB a mais (comentário do próprio
  teste: 11,3 KB em `dist-limite`), então a folga no pior caso é de cerca de 100 bytes.
- Com **todas** as receitas das seções 3 e 4 aplicadas: `index.html` cai para 10.896 bytes (368 a menos),
  o script da página sobe 10 bytes (7.949), o JS inicial fica em 133.895 e a `404.html` em 1.727.

Para medir com exatidão:

```bash
npm run build && node -e '
const fs = require("fs"), z = require("zlib");
const gz = (f) => z.gzipSync(fs.readFileSync("dist/" + f), { level: 9 }).length;
const o = {};
for (const n of fs.readdirSync("dist/assets")) { const k = /^(.+?)-[\w-]{8}\.js$/.exec(n)?.[1]; if (k) o[k] = gz("assets/" + n); }
for (const f of ["index.html", "politica-de-privacidade.html", "404.html"]) o[f] = gz(f);
o.jsInicial = o.index + o.worker + o.three;
console.log(o);'
```

Antes de qualquer push, meça também com um Node 24 de verdade (baixe o tarball de nodejs.org; `npx
node@24` não troca o binário). Se a folga de algum teto ficar abaixo de 300 bytes no Node 26, avise o dono.

### Qualidade

- Suíte: 371 de 371. Lint e tipos limpos.
- Lighthouse local, uma execução: celular 99 de desempenho, 100 de acessibilidade, 100 de boas práticas,
  LCP 1,98 s, CLS 0; desktop 100, 100, 100. O TBT do celular deu 71 ms nessa execução, acima do teto de
  50 ms do script; a máquina estava ocupada e a medida não foi repetida.
- Com a fonte atrasada 1,5 s, o salto de layout é desprezível (CLS 0,011 no desktop e 0,004 no celular).
  Não vale mexer no carregamento da fonte.

### Tamanhos de tela que os testes não cobrem

Todos os defeitos da seção 3 estavam fora das telas de `tests/layout.test.mjs`. Ao validar qualquer
mudança visual, confira também:

- **1366×640 e 1280×595**: a janela útil de um notebook 1366×768 ou 1280×720 com a moldura do navegador;
- **320, 360 e 375 px** de largura;
- **768×1024, 820×1180 e 1024×1366**: tablet em pé;
- a **404 num endereço com subpasta**.

## 2. O que já está feito nesta branch

| Commit    | O que faz                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------ |
| `0e2502f` | `src/base.css`: fonte, tokens e reset num arquivo só, embutido no `index.html` e na política           |
| `4a3784e` | `escapeHtml` só em `build/texto.js`                                                                    |
| `e747779` | 48 erros de tipo do 3D corrigidos por JSDoc, `GLYPHS` exportado, `typecheck` sem filtro, trava refeita |

Coisas a saber:

- **Como a base é embutida**: cada página tem `@import '/src/base.css';` no topo do seu `<style>`. O
  próprio Vite junta o arquivo no HTML, no build e no servidor de desenvolvimento. Não há plugin.
- Tokens e `@font-face` só existem em `src/base.css`. Um teste (`tests/brand.test.mjs`, "a fonte e os
  tokens têm uma fonte só") reprova cor em hexadecimal ou `@font-face` escritos nas páginas.
- O `index.html` ainda redefine tokens dentro de media queries (`:root { --hdr-h: ... }`). Isso é
  esperado.
- A **404 ainda não usa a base**. É o item 3.6.
- `npm run typecheck` agora é `tsc -p jsconfig.json && tsc -p jsconfig.pagina.json` e checa `src/` inteiro.
- Existe um `CLAUDE.md` na raiz, ainda sem commit. O dono decide se versiona.

## 3. Layout: 6 defeitos medidos

### 3.1 Notebook comum abre no modo compacto, e o cartão da abertura cobre a máquina

**Problema.** A regra `@media (max-height: 700px) and (min-aspect-ratio: 1/1)` (`index.html`, linha 462)
liga o layout compacto dos cartões da história. Um notebook 1366×768 tem cerca de 640 px de altura útil
com a moldura do navegador, então cai nela: o título desce de 46 para 30 px, o cartão cola no cabeçalho,
e somem a região atendida e o "Role para ver". O modo existe para janelas realmente baixas (zoom de 200%,
celular deitado).

Há um segundo defeito no mesmo cartão. A regra `.card:has(h1) { width: min(44rem, 100%); }` (linha 387)
tem largura fixa, mas a cena encolhe com a tela. Borda direita do cartão menos borda esquerda do
alimentador de chapas, calculado pela câmera do projeto:

| Largura da janela | Folga hoje | Com a receita |
| ----------------: | ---------: | ------------: |
|             1.024 |    -171 px |        -14 px |
|             1.280 |     -37 px |        +22 px |
|             1.366 |      +7 px |        +28 px |
|             1.440 |     +45 px |        +45 px |
|             1.920 |     +57 px |        +57 px |

Negativo quer dizer que o cartão cobre a máquina. No celular deitado (844×390) o cartão de 704 px cobre
203 px da cena.

**Como fazer.** Três mudanças no `<style>` do `index.html`.

1. Troque a regra de `.card:has(h1)` (busque `.card:has(h1) {`):

   ```css
   .card:has(h1) {
     /* a largura acompanha o tamanho do título (13,167 vezes ele, mais o respiro do cartão): a abertura
        cabe em 2 linhas e para antes da máquina em qualquer largura; de 1412 px para cima dá os mesmos
        44rem de antes */
     width: min(calc(var(--t-display) * 13.167 + 4.5rem), 100%);
   }
   ```

   De onde vem o 13,167: o cartão de 44rem tem miolo de 632 px para um título de 48 px (632 / 48). O
   4,5rem é a soma dos respiros laterais do cartão.

2. Troque a condição do bloco compacto (busque `@media (max-height: 700px)`) e acrescente a largura do
   cartão da abertura como primeira regra dele. O resto do bloco fica como está:

   ```css
   @media (max-height: 560px) and (min-aspect-ratio: 1/1),
     (max-height: 700px) and (max-width: 1199px) and (min-aspect-ratio: 1/1) {
     /* no compacto o título tem 30 px: o cartão da abertura não precisa cobrir a máquina */
     .card:has(h1) {
       width: min(32rem, 100%);
     }
     .step {
       /* ... */
     }
   }
   ```

   O compacto passa a valer só com até 560 px de altura, ou com até 700 px quando a janela tem menos de
   1200 px de largura (tablet deitado).

3. Atualize o comentário de `docs/notas-de-integracao-v4.md`, seção 6, que diz
   "`(max-height: 700px)` em paisagem = compacto".

**Validado na cópia.** Em 1366×643 e 1280×595 o layout normal cabe: cartão de 366 a 372 px de altura,
pelo menos 77 px livres acima e 85 abaixo, e a dica de rolagem a 45 px ou mais do cartão. O título fica em
2 linhas de 1.024 a 2.560 px. De 1.412 px para cima nada muda (704 px em 1440, 792 em 1920, 880 em 2560).
Em 844×390, 924×540 e 1024×690 o compacto continua valendo, com o cartão em 512 px.

**Não validado.** O conteúdo no limite dos schemas nas telas novas. O teste de limites só roda as telas
de `tests/layout.test.mjs`: acrescente as telas novas (item 6.1) e rode `node --test
tests/limites.test.mjs`. Se o cartão não couber com o texto máximo, **não** baixe o limite do schema por
conta própria: avise o dono.

**Testes.** Nenhum teste atual quebra. A tela `1366x768` da paridade visual muda (o cartão passa de 704
para 684 px), o que é esperado.

**Decisão do dono?** Não: é correção. Só a tela 1366×768 muda de desenho em relação a hoje.

### 3.2 No celular o logo do cabeçalho encolhe abaixo do mínimo do manual

**Problema.** O cabeçalho (`.hdr .wrap`, linha 185) é um flex com o logo, o botão "Pedir orçamento"
(190 px) e o menu. O `.logo` (linha 246) pode encolher, e a imagem tem `max-width: 100%` com altura fixa,
então o SVG é desenhado menor dentro da caixa:

| Largura da tela | Logo desenhado | Símbolo |
| --------------: | -------------: | ------: |
|             320 |          14 px |    3 px |
|             360 |          54 px |   14 px |
|             390 |          84 px |   21 px |
|             412 |         106 px |   27 px |
|     768 ou mais |         136 px |   34 px |

O manual da marca (§4) pede símbolo de 28 px ou mais no lockup horizontal.

Além disso, até 768 px o botão do cabeçalho é redundante: a regra `body:has(.fab.on) .hdr .btn`
(linha 1399) o esconde sempre que a barra do WhatsApp está à vista, e `src/story.js` liga a barra a
partir do 2º capítulo. Ele só aparece no 1º capítulo, na mesma tela do botão grande do cartão.

**Como fazer.**

1. Em `.logo` (busque `.logo {`), acrescente `flex: none;` como primeira declaração:

   ```css
   .logo {
     flex: none; /* o logo nunca cede espaço: encolhido, o símbolo fica abaixo do mínimo do manual (§4) */
     display: inline-flex;
     align-items: center;
     padding: 0.5rem 0;
   }
   ```

2. No **segundo** bloco `@media (max-width: 768px)` do arquivo (o que tem `.fab`; busque
   `body:has(.fab.on) .hdr .btn`), troque o comentário e as duas regras do botão do cabeçalho por:

   ```css
   /* até 768 px o cabeçalho fica sem botão: ele só aparecia no 1º capítulo, junto do botão grande do
      cartão, e tirava o espaço do logo; do 2º capítulo em diante quem chama é a barra */
   .hdr .btn {
     display: none;
   }
   ```

   Não mexa na regra `.hdr .btn { padding: 0 1rem; }` do bloco `(max-width: 760px), (max-aspect-ratio:
1/1)`: ela ainda vale para tablet em pé com mais de 768 px.

**Validado na cópia.** Logo com 136 px em todas as larguras, de 320 a 1920.

**Testes que quebram.** `tests/layout.test.mjs`, os dois testes "escondida no capítulo 1, à vista do 2 ao
5 e o cabeçalho sem botão" (360×640 e 390×844; o de limites falha junto, pelo mesmo motivo). O helper
`expect` de lá exige o botão visível quando a barra está escondida. Troque a condição por:

```js
(bar) => {
  const fab = document.querySelector('#fab');
  const shown = getComputedStyle(fab).visibility === 'visible';
  const button = getComputedStyle(document.querySelector('#hdr .btn')).display;
  return fab.classList.contains('on') === bar && shown === bar && button === 'none';
},
```

e renomeie o teste para "... e o cabeçalho sempre sem botão".

**Teste novo.** O do logo, no item 6.2.

**Documentação.** No README, seção "Seções da página", o trecho "(o botão do cabeçalho sai enquanto ela
está à vista)" vira "(até 768 px o cabeçalho não tem botão)". Em `docs/notas-de-integracao-v4.md`,
ajuste as linhas de `#hdr` e `#fab` da tabela e o item "Botão flutuante" da seção 7.

### 3.3 O botão principal vaza do cartão em tela estreita

**Problema.** `.btn` tem `white-space: nowrap` (linha 85) e, no bloco de celular, `.actions .btn { flex:
1 1 100%; }` (linha 556) sem `min-width: 0`. A largura mínima do botão "Pedir orçamento no WhatsApp" é
319 px:

| Largura da tela | O botão passa do respiro do cartão | Passa da borda do cartão |
| --------------: | ---------------------------------: | -----------------------: |
|             320 |                              63 px |                    43 px |
|             344 |                              39 px |                    19 px |
|             360 |                              23 px |                     3 px |
|             375 |                               8 px |                não passa |
|     384 ou mais |                          não passa |                não passa |

Em 320 px o rótulo sai da tela, o que fere o critério de reflow (WCAG 1.4.10). O schema aceita um rótulo
de até 32 caracteres (hoje são 27), o que piora o caso.

**Como fazer.** No bloco `@media (max-width: 760px), (max-aspect-ratio: 1/1)`, troque a regra
`.actions .btn` (busque `flex: 1 1 100%;`):

```css
.actions .btn {
  flex: 1 1 100%;
  min-width: 0;
  padding: 0.5rem 0.75rem;
  line-height: 1.2;
  text-align: center;
  white-space: normal; /* um rótulo longo quebra em vez de vazar do cartão */
}
```

A regra seguinte, `.actions .btn-soft`, continua valendo para o link "Ver produtos".

**Validado na cópia.** Nada vaza do respiro do cartão em nenhuma largura nem capítulo. O botão segue com
56 px de altura; em 320 px o rótulo quebra em 2 linhas centralizadas, e de 344 px para cima fica numa
linha.

**Testes.** Nenhum quebra. O teste novo é o do item 6.1 ("nada vaza do respiro do cartão").

### 3.4 No tablet em pé o cartão da abertura é mais estreito que os outros

**Problema.** `.card:has(h1)` (especificidade 0,1,1) vence o `.card { width: 100%; }` do bloco de celular
e retrato (linha 533). Em retrato com 768 px ou mais, o cartão da abertura fica com 704 px e os outros
quatro ocupam a largura toda: 744 em 768, 796 em 820, 1.000 em 1024. O cartão "pula" de largura do 1º
para o 2º capítulo.

**Como fazer.** No bloco `@media (max-width: 760px), (max-aspect-ratio: 1/1)`, acrescente o seletor à
regra do cartão:

```css
.card,
.card:has(h1) {
  width: 100%;
  max-height: none;
  padding: 1.125rem 1.25rem 1.25rem;
}
```

Faça isto **depois** do item 3.1: a regra de retrato precisa vir depois da do compacto no arquivo (já
vem) para vencer em 720×450, onde os dois blocos valem.

**Validado na cópia.** Os 5 cartões com a mesma largura em 768×1024, 820×1180 e 1024×1366.

**Testes.** Nenhum quebra. Teste novo no item 6.1.

### 3.5 O rodapé quebra no meio dos dados

**Problema.** `footerFields`, em `build/render.js`, junta rua, bairro, cidade-UF e CEP com " · " num texto
só. Em coluna estreita o navegador quebra onde quer:

- em 1440: "CEP 00000-" numa linha e "000" na outra;
- em 1024: "Santo André-" e "SP";
- em 390: "CEP" numa linha e o número na seguinte.

E até 760 px a grade `.foot-info` tem 2 colunas em que só o endereço e o CNPJ ocupam a linha inteira
(linha 1268): o horário fica em meia coluna e quebra em "Seg a Sex, 8h às" e "17h", com a outra metade
vazia.

**Como fazer.**

1. Em `build/render.js`, função `footerFields`, o endereço passa a sair em linhas:

   ```js
   const place = address.street
     ? [
         address.street,
         address.district,
         site.cityState,
         address.postalCode && `${site.content.rodape.rotulos.cep} ${address.postalCode}`,
       ]
         .filter(Boolean)
         .map(escapeHtml)
         .join('<br />')
     : '';
   ```

   e, no objeto devolvido, `endereco: place,` no lugar de `endereco: place && escapeHtml(place),`. Cada
   pedaço é escapado antes de juntar.

2. No `index.html`, bloco `@media (max-width: 760px)` do rodapé (busque `.f-endereco,`):

   ```css
   .f-endereco,
   .f-horario,
   .f-cnpj {
     grid-column: 1 / -1;
   }
   ```

**Validado na cópia.** Em todas as 18 telas o endereço sai em 4 linhas (rua, bairro, cidade-UF, CEP) e o
horário numa linha só. O html-validate aceita o `<br />` dentro do `<dd>`.

**Testes.** Nenhum quebra (os testes procuram cada dado, não o texto junto). Acrescente em
`tests/site-config.test.mjs`, no teste "com os dados de demonstração tudo aparece", uma conferência de
que o endereço sai com `<br />` entre os pedaços e que cada pedaço é escapado.

**Efeito colateral.** O JSON-LD não muda (ele monta o endereço por conta própria). A descrição de
`rodape.rotulos.cep` no schema continua certa.

### 3.6 A 404 perde o logo em subpastas, não carrega a fonte e tem tokens próprios

**Problema.** Três coisas no `404.html`:

- O build usa `base: './'`, então o logo e o favicon saem como `./brand/...` e `./favicon.svg`. O GitHub
  Pages serve a 404 em qualquer endereço que não existe. Em `/vanpack-pages/a/b` ou
  `/vanpack-pages/nao-existe/` esses caminhos apontam para o lugar errado: o logo quebra.
- Não há `@font-face` nela: o título sai na fonte do sistema.
- Os tokens foram copiados à mão e já divergiram (`--floresta-dark: #0f3d2c` contra `#0d3c2a`; raio do
  botão de 4 px contra 0,375rem; peso 850).

**Como fazer.**

1. Troque o `<style>` inteiro do `404.html` por este (usa a base comum):

   ```html
   <style>
     /* a fonte, os tokens da marca e o reset, comuns às três páginas: o build embute aqui */
     @import '/src/base.css';
     body {
       min-height: 100vh;
       min-height: 100svh;
       display: flex;
       flex-direction: column;
       align-items: center;
       justify-content: center;
       padding: 2rem 1.5rem;
       text-align: center;
     }
     .card {
       max-width: 32rem;
       padding: 3rem 2rem;
       border-radius: 0.5rem;
       background: var(--tint);
     }
     .logo {
       display: inline-block;
       margin-bottom: 2rem;
     }
     .logo img {
       width: 11.25rem;
       height: auto;
     }
     h1 {
       margin-bottom: 1rem;
       font-size: 2.25rem;
       font-weight: 900;
       letter-spacing: -0.025em;
       line-height: 1.1;
     }
     p {
       margin-bottom: 2rem;
       line-height: 1.5;
     }
     .btn {
       display: inline-flex;
       align-items: center;
       justify-content: center;
       min-height: 3.5rem;
       padding: 0 2rem;
       border-radius: 0.375rem;
       background: var(--floresta);
       color: var(--papel);
       font: 700 1rem/1 var(--font);
       text-decoration: none;
       transition: background-color 0.2s;
     }
     .btn:hover {
       background: var(--floresta-dark);
       color: var(--papel);
     }
   </style>
   ```

   O `color` em `.btn:hover` é necessário: sem ele vence o `a:hover` da base e o texto some no fundo.

2. Em `vite.config.js`, acrescente dois plugins antes de `siteFilesPlugin` e ligue os dois na lista
   `plugins`, logo depois de `siteFilesPlugin(site)`:

   ```js
   /**
    * A 404 do GitHub Pages é servida em qualquer endereço que não existe, inclusive dentro de subpastas
    * (/vanpack-pages/a/b), e ali um caminho relativo (./brand/...) aponta para o lugar errado. No build ela
    * ganha um <base> com o caminho do site (o da VITE_SITE_URL), e tudo passa a sair da raiz do site.
    */
   function notFoundBasePlugin(site) {
     const path = new URL(site.siteUrl).pathname;
     return {
       name: 'vanpack:404-base',
       apply: 'build',
       transformIndexHtml: {
         order: 'post',
         handler(html, { filename }) {
           if (basename(filename) !== '404.html') return html;
           return html.replace(
             /<meta charset="utf-8"\s*\/?>/i,
             (m) => `${m}\n    <base href="${path}" />`,
           );
         },
       },
     };
   }

   /** No `vite preview` o site também responde no caminho do site publicado, como no GitHub Pages. */
   function previewSubpathPlugin(site) {
     const path = new URL(site.siteUrl).pathname;
     return {
       name: 'vanpack:preview-subcaminho',
       configurePreviewServer(server) {
         if (path === '/') return;
         server.middlewares.use((req, _res, next) => {
           if (req.url?.startsWith(path)) req.url = `/${req.url.slice(path.length)}`;
           next();
         });
       },
     };
   }
   ```

   `basename` já é importado no arquivo. O `<base>` é do mesmo domínio, então a CSP (`base-uri 'self'`)
   aceita. Ele só entra no build: no `npm run dev` os caminhos da 404 já são absolutos e funcionam.

**Validado na cópia.** Servida como o GitHub Pages serve (a 404 com status 404 em qualquer caminho que
não existe sob `/vanpack-pages/`), em `nao-existe`, `nao-existe/`, `pasta/nao-existe` e `a/b/c`: logo e
favicon carregam, a Archivo carrega, nenhum pedido falha e nenhuma violação de CSP. A página pesa 1.727
bytes gzip (teto de 2.048).

**Não validado.** O segundo plugin (`previewSubpathPlugin`) carregou sem quebrar nenhum teste, mas
ninguém pediu um endereço com o prefixo pelo `vite preview`. Confira à mão: `npm run build && npm run
preview` e abra `http://localhost:4173/vanpack-pages/404.html`. Se der trabalho, tire esse plugin: ele só
serve para olhar a 404 no preview local.

**Testes.** Nenhum quebra. Acrescente:

- em `tests/brand.test.mjs`, no teste "a fonte e os tokens têm uma fonte só", inclua `404.html` na lista
  de páginas;
- o teste da 404 aninhada, no item 6.3.

**Documentação.** No README, a linha da 404 na seção "Arquitetura".

## 4. Visual: sugestões que dependem do dono

Cada item muda a aparência por opinião de design. **Pergunte antes** e faça um commit por item.

### 4.1 Carrossel: com poucos logos, o mesmo logo aparece repetido

**Problema.** Em `src/carrossel.js`, função `layout`, a faixa só fica parada quando os itens cabem na
largura **e** o sistema pede movimento reduzido. Fora disso ela copia os itens até encher a janela. Com 1
logo (o caso de hoje) aparecem 4 cópias lado a lado em 1440 px, e parece defeito.

Isto mexe numa decisão do dono (commit `a496fae`, "a esteira anda mesmo com poucos clientes"). O "sem
controles" não muda.

**Como fazer.**

1. Em `src/carrossel.js`, depois de `const RESUME_MS`:

   ```js
   const MIN_TO_RUN = 4; // com menos logos a esteira mostraria o mesmo logo repetido lado a lado
   ```

   e a condição de `layout()`:

   ```js
   if (originals.length < MIN_TO_RUN || (nextWidth - gap <= width + 0.5 && reduced.matches)) {
   ```

   Atualize o comentário do topo do arquivo e o que fica logo acima dessa condição.

2. No `index.html` (busque `.carrossel.estatico .carrossel-trilho`), para 2 ou 3 logos quebrarem linha
   no celular:

   ```css
   .carrossel.estatico .carrossel-trilho {
     width: auto;
     flex-wrap: wrap;
     justify-content: center;
   }
   ```

**Validado na cópia.** Com 1 logo e movimento ligado: estado `estatico`, nenhuma cópia, centralizado em
1440 e em 390. Custo: 10 bytes gzip no script da página.

**Testes que quebram.** `tests/carrossel.test.mjs`, bloco "poucos clientes: a esteira anda do mesmo
jeito": falham "1440×900 com 1", "390×844 com 1" e "390×844 com 2" (o de 4 itens em 1440 continua
passando). Reescreva o bloco: com 1 a 3 itens, em qualquer largura e com movimento ligado, espera-se
`estatico`, zero cópias, itens centralizados e nenhuma rolagem horizontal (use `open(screen, { items,
expected: 'estatico' })`); com 4 ou mais, anda. Corrija também o comentário do topo e o da constante
`MANY`.

**Documentação.** README (seção "Seções da página" e a descrição de `tests/carrossel.test.mjs`),
`docs/notas-de-integracao-v4.md` (linha de `[data-carrossel]` e a seção 7) e o comentário do CSS do
carrossel no `index.html`.

### 4.2 "Por que a Vanpack" repete o que a história já disse

**Problema.** Os 3 itens de `content/diferenciais.yaml` repetem `content/historia.yaml`: "direto com quem
fabrica" (a abertura diz "direto da fábrica e sem intermediário"), "mesma medida e impressão em todos os
lotes" (o 3º cartão diz quase o mesmo) e "orçamento sem formulário" (o 4º cartão e a seção final). A
seção não acrescenta informação.

**Precisa do dono.** O conteúdo certo são fatos que a página ainda não responde e que não ferem as regras
(sem prazo, sem número inventado): formas de pagamento, impressão, que arte mandar, nota fiscal. **Não
escreva esses textos por conta própria.** Leve a pergunta ao dono.

**O que dá para fazer sem inventar nada.** As formas de pagamento já existem em `content/empresa.yaml`
(campo `pagamento`) e não aparecem em lugar nenhum. O caminho mais simples é um campo novo no rodapé, que
usa o mecanismo que já existe (não validado):

1. `index.html`, dentro de `<dl class="foot-info">`, depois do horário:

   ```html
   <div class="f-pagamento" data-field="pagamento" hidden>
     <dt>{{rodape.rotulos.pagamento}}</dt>
     <dd></dd>
   </div>
   ```

2. `build/render.js`, em `footerFields`: `pagamento: site.paymentMethods && escapeHtml(site.paymentMethods),`.
3. `content/rodape.yaml` e `content/schemas/rodape.schema.json`: o rótulo `rotulos.pagamento` (texto,
   até 20 caracteres, obrigatório como os outros).
4. Confira `tests/template.test.mjs` (todo texto de `content/` precisa aparecer em alguma página) e
   `tests/site-config.test.mjs` (com a empresa vazia nenhum campo sobra).

**Um ajuste de texto que resolve um problema medido.** O título "Mesma medida e impressão em todos os
lotes" (41 caracteres) ocupa 3 linhas de 768 a 1366 px e no celular pequeno. Um título de até uns 30
caracteres cabe em 2. É texto de negócio: sugira ao dono, não troque sozinho.

### 4.3 No celular, título e texto dos diferenciais têm o mesmo tamanho

**Problema.** Até 600 px, `.pillar h3` e `.pillar p` usam `var(--t-lead)` (20 px): só o peso separa
título de texto. E o texto corrido da página tem três tamanhos: 16 px nos cartões da história, 18 nos
produtos e 20 nos diferenciais.

**Como fazer.** No segundo bloco `@media (max-width: 600px)` (busque `.pillar h3` dentro dele):

```css
.pillar h3 {
  font-size: var(--t-item);
}
.pillar p {
  font-size: var(--t-body);
}
```

**Validado na cópia.** Título com 24 px e texto com 18 px no celular. Nenhum teste quebra.

### 4.4 Diferenciais sem os ícones de linha

**Problema.** Os ícones (fábrica, grade, balão) são o elemento mais genérico da página. No celular já
somem (`.pillar svg { display: none }`). A sugestão é tirar no desktop também.

**Como fazer** (remoção completa, para não sobrar campo morto):

1. `build/render.js`, bloco `diferenciais`: o artigo passa a ser
   `<article class="pillar"><h3>...</h3><p>...</p></article>`, sem o `<svg>`. Tire `icon` do parâmetro.
2. `index.html`:
   - apague do sprite os 4 símbolos `i-fabrica`, `i-lotes`, `i-conversa` e `i-caixa` (o `i-wa` fica);
   - em `.pillar`, `grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);`
   - apague a regra `.pillar svg` e a regra `.pillar > h3:first-child` (com o comentário dela);
   - no bloco de tablet (`min-width: 601px` e `max-width: 860px`), `grid-template-columns: minmax(0,
1fr) minmax(0, 1fr);`
   - no bloco de celular, apague `.pillar svg { display: none; }`, `.pillar > h3:first-child` e o
     comentário sobre o ícone.
3. `site.config.js`: apague `DIFF_ICONS` e a linha `icon: text(item.icone)`.
4. `content/schemas/diferenciais.schema.json`: apague a propriedade `icone`.
5. `content/diferenciais.yaml`: apague as linhas `icone:` e ajuste o comentário do topo.

**Validado na cópia** (só os passos 1 e 2): linhas com título à esquerda e texto à direita, sem buraco.
É daqui que sai a maior parte dos 368 bytes ganhos no `index.html`.

**Testes que quebram.** `tests/site-config.test.mjs`: "diferenciais vêm de content/" (o HTML esperado do
artigo tem o `<svg>`; tire também a parte "sem ícone") e "cada ícone de diferencial tem o seu
`<symbol>`" (apague o teste e o import de `DIFF_ICONS`).

**Documentação.** README (onde cita os ícones `fabrica`, `lotes`, `conversa`, `caixa`) e
`docs/go-live.md`.

### 4.5 A onda de papelão com o perfil real do papelão ondulado

**Problema.** O divisor entre seções é um fio fino ondulado, esticado com `preserveAspectRatio="none"`
(a onda muda de passo conforme a largura). A sugestão é desenhar o corte do papelão: capa, onda e capa,
com passo fixo.

**Como fazer.**

1. No `index.html` há dois blocos `<div class="wave" ...>`. No primeiro, troque o `<svg>` inteiro por:

   ```html
   <svg width="100%" height="24">
     <defs>
       <pattern id="onda" width="44" height="24" patternUnits="userSpaceOnUse">
         <path
           d="M0 1.5h44M0 22.5h44M0 19.5C7 19.5 15 4.5 22 4.5S37 19.5 44 19.5"
           fill="none"
           stroke="currentColor"
           stroke-width="3"
         />
       </pattern>
     </defs>
     <rect width="100%" height="24" fill="url(#onda)" />
   </svg>
   ```

   No segundo (o que tem `data-need="tem_diferenciais"`), por:

   ```html
   <svg width="100%" height="24">
     <rect width="100%" height="24" fill="url(#onda)" />
   </svg>
   ```

   O padrão fica no primeiro bloco porque ele existe sempre; o segundo some sem diferenciais.

2. No CSS, troque as regras `.wave svg` e `.block + .wave svg` por uma só:

   ```css
   .wave svg {
     color: var(--kraft);
   }
   ```

**Validado na cópia.** O desenho lê como papelão ondulado e emenda sem costura. Passam o html-validate, o
teste do Kraft (`tests/brand.test.mjs`, "Kraft é só o material") e o axe.

### 4.6 CTA final sem o logo

**Problema.** Com a seção final à vista aparecem três logos da Vanpack na mesma tela: cabeçalho, CTA e
rodapé logo abaixo.

**Como fazer.**

1. `index.html`: apague a `<img class="mark" ...>` da seção `#orcamento`, a regra `.cta .mark` e o bloco
   `@media (min-width: 861px) { .cta .how { padding-top: 4.625rem; } }` (ele só existia para alinhar os
   passos com o título por baixo do logo).
2. `tests/orcamento.test.mjs`: a soma `visita` inclui `gzip('brand/vanpack-horizontal-negativo.svg')`
   ("o logo do CTA final"). Tire essa parcela e baixe o teto de `visita` para o valor medido mais 0,1 KB.

**Validado na cópia.** O título fica na linha do 1º passo.

**Teste que quebra.** `tests/brand.test.mjs`, "logotipo: símbolo >= 24 px": exige `count >= 4` imagens
de marca. Passa a ser 3 (cabeçalho, carregamento, rodapé); ajuste o número e a mensagem.

### 4.7 Título da abertura maior: não fazer por CSS

Na revisão eu sugeri subir o título de 48 para 56 a 64 px. **Não cabe.** O cartão termina a 45 px do
alimentador em 1440 px, e crescer o título exige alargar o cartão na mesma proporção. Só dá com
reenquadramento da câmera, que é 3D: o item está no relatório do 3D, com as medidas.

## 5. Código

### 5.1 Regras CSS sem uso

`.k` (linha 66) e `.card .k` (linhas 395, 474 e 538) não têm nenhum elemento: a classe `k` não aparece no
HTML, em `build/render.js` nem em `src/`. Apague as 4 regras. Validado na cópia.

### 5.2 Comentário desatualizado que vai para o site publicado

`index.html`, linha 35: `<!-- JSON-LD montado inteiro em build/render.js a partir do .env -->`. Os dados
vêm de `content/`. Corrija o texto. O Vite não tira comentários do HTML, então ele é publicado.

### 5.3 `clamp` duplicado (opcional, baixo valor)

`src/story.js` e `src/tour.js` definem o mesmo `clamp`. Dá para o `tour.js` importar de `story.js`. Não
validado; o ganho é de poucos bytes, que ajudam o teto do JS inicial. Meça antes e depois.

A mesma string de media query de celular existe em `src/render/stage.js` e `src/produtos/montar.js`. É
3D: não mexa por aqui.

### 5.4 Textos de interface presos no código

Os textos do assistente de orçamento (`src/wizard.js`), "Fechar", "Número copiado." e "Role para ver ↓"
estão no código. O README documenta isso como decisão. Não mexa.

### 5.5 Tipos do Node à frente do Node do CI (baixo)

`package.json` tem `@types/node` na versão 26 e o `.nvmrc` é 24. Os tipos aceitam APIs que o Node do CI
pode não ter. Não foi visto nenhum caso concreto. Se for mexer, alinhe com o `.nvmrc` e rode `npm run
typecheck`.

## 6. Testes e CI

### 6.1 `tests/layout.test.mjs`: telas e conferências que faltam

1. Acrescente a `SCREENS`:

   ```js
   { name: '1366×640 (notebook, janela útil)', width: 1366, height: 640 },
   { name: '1280×595 (notebook, janela útil)', width: 1280, height: 595 },
   { name: '375×667 (celular)', width: 375, height: 667, mobile: true },
   { name: '768×1024 (tablet em pé)', width: 768, height: 1024, mobile: true },
   ```

   Essas telas entram em todos os grupos do arquivo e no teste de limites. **Não validado**: rode
   `node --test tests/layout.test.mjs tests/limites.test.mjs` e veja o que aparece. Se uma tela nova
   reprovar com o conteúdo no limite, relate ao dono.

2. Em `measure`, meça se algo vaza do respiro do cartão e devolva o valor:

   ```js
   const style = getComputedStyle(card);
   const cardBox = card.getBoundingClientRect();
   const inner = {
     left: cardBox.left + parseFloat(style.paddingLeft),
     right: cardBox.right - parseFloat(style.paddingRight),
   };
   const spill = Math.max(
     0,
     ...[...card.querySelectorAll('h1, h2, p, a, .seal')]
       .filter((el) => getComputedStyle(el).display !== 'none')
       .map((el) => el.getBoundingClientRect())
       .filter((r) => r.width > 0)
       .map((r) => Math.max(r.right - inner.right, inner.left - r.left)),
   );
   ```

   e, no teste de cada capítulo: `assert.ok(m.spill <= 0.5, 'nada vaza do respiro do cartão');`

   Antes do item 3.3 este teste reprova em 360×640 (23 px). É a prova de que ele enxerga o defeito.

3. Um teste só de largura para 320 e 344 px (sem pôr 320 em `SCREENS`, porque a 1ª tela inteira pode não
   caber ali com o conteúdo máximo): abrir a página, medir o mesmo `spill` no cartão da abertura e exigir
   zero, e exigir `scrollWidth <= innerWidth`.

4. Tablet em pé: em 768×1024, 820×1180 e 1024×1366, os 5 `.card` têm a mesma largura
   (`new Set(larguras).size === 1`).

### 6.2 `tests/brand.test.mjs`: o teste do logo mede a caixa, não o desenho

O teste "logotipo: símbolo >= 24 px" abre só em 1440×900 e usa a altura da `<img>` como tamanho do
símbolo. Com a imagem espremida, a caixa segue com 34 px e o desenho encolhe: o teste não vê.

- Rode-o também em 390×844 e 360×640.
- Calcule o símbolo pelo desenho:

  ```js
  const ratio = Number(img.getAttribute('width')) / Number(img.getAttribute('height'));
  const symbol = Math.min(r.height, r.width / ratio);
  ```

  (no lockup horizontal a proporção é 4 e o símbolo ocupa a altura do desenho; no símbolo sozinho é 1).

Antes do item 3.2 o teste passa a reprovar em 360 px (14 px). Depois, dá 34.

### 6.3 `tests/subcaminho.test.mjs`: a 404 num endereço com subpasta

O servidor de teste (`serveUnder`) devolve o texto "404" para o que não existe. O GitHub Pages devolve a
`404.html`. Mude o ramo de erro para devolver a página quando o caminho está dentro de `BASE`:

```js
if (!file || !file.startsWith(DIST) || !existsSync(file) || !statSync(file).isFile()) {
  // como o GitHub Pages: dentro do site, o que não existe devolve a 404.html com status 404
  const inside = path.startsWith(base);
  res.writeHead(404, inside ? { 'Content-Type': TYPES['.html'] } : {});
  res.end(inside ? readFileSync(`${DIST}404.html`) : '404');
  return;
}
```

Teste novo: para `nao-existe/`, `pasta/nao-existe` e `a/b/c`, abrir `${server.url}${path}` e exigir que
o logo carregou (`img.complete && img.naturalWidth > 0`), que a fonte carregou (`document.fonts` tem
`Archivo` com `status === 'loaded'`) e que nenhum pedido falhou **além do próprio documento**, que
responde 404 de propósito. O helper `failures` do arquivo conta toda resposta 400 ou mais e os erros de
console: para este teste, abra o contexto direto (`browser.newContext()`), registre `page.on('response')`
e ignore a URL do documento.

O teste "o servidor de teste é rigoroso" continua valendo: fora de `BASE` o status é 404, e
`nao-existe.js` dentro de `BASE` também.

### 6.4 Tudo é testado só no Chrome com WebGL por software

`scripts/lib.mjs` abre o Chrome do sistema. Nada roda em WebKit nem em Firefox, e o iPhone é Safari. A
página depende de OffscreenCanvas em worker, de `svh`, de `:has()` e de rolagem programada.

Sugestão, **não validada** (não há WebKit instalado nesta máquina): um teste de fumaça fora da suíte,
disparado à mão, para não gastar minutos do CI em todo pull request.

- `scripts/fumaca-webkit.mjs`: sobe o `dist/` com `startServer`, abre com `webkit.launch()` do
  `playwright-core`, espera `.stage.ready, .stage.no-gl`, rola até `#produtos`, espera um
  `.model-3d.pronto` e falha se houver erro de página.
- Um workflow novo com `on: workflow_dispatch` só: `npm ci --ignore-scripts`, `npx playwright-core
install --with-deps webkit`, `npm run build`, `node scripts/fumaca-webkit.mjs`.
- Não ponha o arquivo em `tests/*.test.mjs`: a suíte roda tudo o que está lá e não há WebKit no runner.

O WebKit do Playwright no Linux não é o Safari do iPhone, mas pega erro de motor. O teste em aparelho de
verdade está no relatório do 3D.

### 6.5 O que não foi auditado a fundo

Li por alto, sem procurar defeito linha a linha: `tests/tour.test.mjs`, `analytics`, `conversion`,
`wizard`, `experiments`, `produtos`, `robustness`, `privacidade`, `content`, `texto`, `site-url`,
`servidor-lento`, `hooks`, `anos`, `erro-de-build`, `paridade` e `three-compartilhado`; os scripts de
`scripts/audit/` e de marca; e os schemas de `site`, `empresa`, `historia`, `orcamento`, `produtos`,
`provas`, `whatsapp` e `clientes`. Uma varredura dessas partes por agentes foi tentada e falhou por
limite de uso, sem devolver nada. Este relatório não tem achados nelas.

## 7. Orçamento de bytes: onde ganhar

- O item 4.4 (ícones) e o 5.1 (`.k`) são os que mais tiram bytes do `index.html`. Se os itens da seção 3
  ficarem perto do teto, aplique o 5.1 antes.
- O item 4.6 baixa a visita completa (um SVG a menos).
- Nenhum item da seção 3 acrescenta JavaScript. O 4.1 acrescenta 10 bytes.
- A ordem recomendada na seção 10 mantém cada commit abaixo dos tetos.

## 8. Documentação que não bate com o código

Corrija cada trecho. Onde um item das seções 3 e 4 muda o comportamento, a documentação dele já está
indicada lá.

| Onde                                                | O que diz                                                                 | O que é                                                                                                  |
| --------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| README, "Seções da página"                          | os produtos têm "a região atendida numa linha sob o título"               | não há nada entre o título de `#produtos` e a lista; a região aparece na abertura e no cartão da entrega |
| README (3 lugares) e `docs/provas/README.md`        | em demo, o cliente sem autorização leva o rótulo "Exemplo"                | o código não põe rótulo nenhum (`content/clientes.yaml` diz "sem rótulo")                                |
| README, "Seções da página"                          | o carrossel "fica parada e centralizada quando os logos cabem na largura" | só com movimento reduzido (ou conforme o item 4.1, se aplicado)                                          |
| README, descrição de `tests/carrossel.test.mjs`     | "a esteira só anda a partir de 6 cartões em 1440 e de 3 em 390"           | o teste diz "poucos clientes: a esteira anda do mesmo jeito"                                             |
| `docs/notas-de-integracao-v4.md`, seção 7           | "Com poucos logos a esteira nem anda"                                     | anda                                                                                                     |
| README, tabela "Onde está cada coisa"               | "Rótulos do rodapé e o aviso do pagamento"                                | o aviso do pagamento saiu no commit `c7bc12b`                                                            |
| README, descrição de `tests/orcamento.test.mjs`     | "JS inicial 131,3 KB, carga inicial 171,1 KB, visita completa 180,7 KB"   | os tetos são 131,0, 171,2 e 181,5                                                                        |
| `docs/go-live.md`, checklist                        | a `og.jpg` "ainda mostra o texto antigo do hero"                          | ela já foi refeita (commit `7e7cb37`); tire o item                                                       |
| `content/empresa.yaml`, comentário                  | a região aparece "na abertura e em O que fabricamos"                      | na abertura e no cartão da entrega                                                                       |
| `docs/notas-de-integracao-v4.md`, tabela da seção 1 | `.optional`: "fim do eyebrow e do parágrafo"                              | não há mais eyebrow                                                                                      |
| `docs/notas-de-integracao-v4.md`, tabela da seção 1 | `.carrossel-janela[role="region"]`                                        | o HTML é um `<section>` com `aria-roledescription`, sem atributo `role`                                  |
| `tests/carrossel.test.mjs`, comentário de `MANY`    | "a esteira anda a partir de 6 em 1440 e de 3 em 390"                      | contradiz o resto do arquivo                                                                             |

`docs/produtos-3d.md` também tem trechos defasados (o canvas "não recebe foco", `peca` "em
site.config.js", "Marca Vanpack"). É documentação do 3D: está no outro relatório.

## 9. SEO, acessibilidade, medição e conteúdo

### 9.1 JSON-LD sem o link do mapa

`buildJsonLd` (`build/render.js`) não inclui `hasMap`, embora `site.mapUrl` exista. Acrescente
`...(site.mapUrl && { hasMap: site.mapUrl }),` e cubra em `tests/site-config.test.mjs` (presente em demo,
ausente com a empresa vazia). Não validado.

**Cuidado**: `tests/conteudo.test.mjs` lê todos os textos do JSON-LD e reprova qualquer coisa com cara de
e-mail. Um link do Google Maps com `@` no meio pode disparar o filtro. Se acontecer, o problema é o link,
não o teste: use o link curto do mapa.

`sameAs` (perfis em redes sociais) também falta, mas precisa de um dado novo em `content/empresa.yaml`.
Precisa do dono.

### 9.2 Reflow em 320 px

Resolvido pelo item 3.3. Depois dele, em 320×568 a primeira tela cabe inteira com o conteúdo de hoje
(título em 4 linhas, botão em 2). Com o conteúdo no limite dos schemas, não foi medido.

### 9.3 Resumo da visita pode se perder no celular (suspeita, não verificada)

`src/analytics.js` envia o `visit_summary` por `setTimeout(sendSummary)` quando a aba some
(`visibilitychange`), para dar tempo ao `web-vitals` de entregar LCP, INP e CLS. Num celular, a página
pode ser congelada antes de o temporizador rodar, e é justamente quem tocou no botão do WhatsApp que some
de vista. Não há evidência de perda. Depois do go-live, compare no Umami o número de `visit_summary` com
o de visualizações, separando celular de desktop. Só mexa no código se a diferença aparecer.

### 9.4 Seção de clientes some em produção

O único cliente listado (Biscoitê) está com `autorizado: false`. Em production a seção `#clientes` e os
links para ela somem. Não é defeito: é a regra. Vale o dono saber que a página vai ao ar sem prova social
enquanto não houver autorização registrada em `docs/provas/`.

## 10. Roteiro de execução

Faça nesta ordem. Depois de cada commit: `npm run lint && npm run typecheck && npm run build` e os testes
indicados. Se um teste não listado falhar, pare e entenda a causa antes de seguir.

| #   | Commit                                                                               | Itens    | Testes a rodar                                              |
| --- | ------------------------------------------------------------------------------------ | -------- | ----------------------------------------------------------- |
| 1   | `chore(css): regras .k sem uso e comentário do JSON-LD`                              | 5.1, 5.2 | `brand`, `html`, `orcamento`                                |
| 2   | `test(layout): telas de notebook, celular e tablet e o que vaza do cartão`           | 6.1      | `layout` (vai reprovar em 360×640: é o defeito do item 3.3) |
| 3   | `fix(layout): o botão da abertura cabe no cartão em tela estreita`                   | 3.3      | `layout`, `limites`, `a11y`, `foco`                         |
| 4   | `fix(layout): notebook comum abre no layout normal e o cartão para antes da máquina` | 3.1      | `layout`, `limites`, `tour`                                 |
| 5   | `fix(layout): no tablet em pé os 5 cartões têm a mesma largura`                      | 3.4      | `layout`                                                    |
| 6   | `fix(layout): cabeçalho sem botão até 768 px e logo no tamanho do manual`            | 3.2, 6.2 | `layout`, `brand`, `tour`, `a11y`, `axe`, `foco`            |
| 7   | `fix(rodape): endereço em linhas e horário na linha inteira`                         | 3.5      | `site-config`, `data-source`, `template`, `html`            |
| 8   | `fix(404): logo, favicon e fonte em qualquer endereço`                               | 3.6, 6.3 | `subcaminho`, `brand`, `html`, `template`, `orcamento`      |
| 9   | `docs: o que não batia com o código`                                                 | 8        | `docs`                                                      |
| 10  | `feat(seo): link do mapa no JSON-LD`                                                 | 9.1      | `site-config`, `conteudo`                                   |

O commit 2 fica vermelho de propósito por um commit. Se preferir a suíte verde em todos, junte o 2 ao 3.

Só com o "sim" do dono, um commit por item: 4.1, 4.3, 4.4, 4.5 e 4.6. O 4.2 depende de conteúdo dele.

### Antes de entregar

- [ ] `npm test` inteiro verde.
- [ ] Bytes medidos (seção 1) e comparados com a tabela; nenhum teto estourado; medido também no Node 24.
- [ ] Conferido à mão no `npm run preview`: 1366×640, 1280×595, 360×640, 320×568, 768×1024 e
      `http://localhost:4173/vanpack-pages/a/b`.
- [ ] `git status` limpo e nenhum push.
- [ ] Na mensagem ao dono: os comandos `npm run dev` e `npm run build && npm run preview`, a lista de
      commits, o que mudou de aparência e o que ficou esperando decisão dele. O pull request vai precisar
      dos rótulos `muda-visual` e `muda-html`, e quem abre é ele.
