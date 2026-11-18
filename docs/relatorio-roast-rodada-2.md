# Relatório de auditoria Roast & Rebuild: rodada 2

Segunda avaliação independente da landing page da Vanpack, com a metodologia da skill **Roast & Rebuild**
([`janderswag/roast-skill`](https://github.com/janderswag/roast-skill/blob/main/SKILL.md)). Avalia o estado
depois da Fase A do plano geral de melhorias e do suporte opcional a e-mail, e compara com a
[rodada 1](relatorio-roast.md).

- **Data:** 17 de novembro de 2026.
- **Avaliado:** branch `feat/revisao-layout-e-codigo`, commit `77a09bd`, com a árvore limpa.
- **Formato do projeto (classificação da skill):** `marketing-site`, landing page estática sem backend.
- **Para quem:** o dono, para decidir o que vem depois; e quem for executar o que ele aprovar.

## Como esta rodada foi feita

1. **Regras da skill cumpridas.** Cada `arquivo:linha` deste relatório foi aberto e conferido no commit
   avaliado; o que não deu para conferir ficou de fora. Nenhum segredo foi lido ou impresso (do `.env`, só os
   nomes das chaves). Nenhuma chamada de rede. A auditoria não alterou código: este relatório é o único
   arquivo novo.
2. **Módulos na divisão pedida pelo dono** (M1 a M6), que não é a da skill nem a da rodada 1. O comparativo
   mapeia uma divisão na outra.
3. **Decisões do dono que esta rodada não reabre:** o tour automático toca sozinho e rola a página; o
   WhatsApp é o canal prioritário e o e-mail é opcional (campo `email` de `content/empresa.yaml`); sem fotos,
   só SVG; só as cores Floresta, Carvão, Papel e Kraft e a fonte Archivo; o 3D principal é travado por hash;
   sem PWA; sem prazo nem promessa de tempo de resposta. Achado que só se resolve contrariando uma delas não
   entra como defeito.

Os relatórios de melhoria citados aqui (`docs/plano-de-melhorias.md` e `docs/plano-de-melhorias-3d.md`) são
cópias locais do dono, fora do controle de versão.

## Fase 0: stack e superfície

| Item                             | O que há                                                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Linguagem                        | JavaScript em módulos ES, com tipos por JSDoc conferidos pelo `tsc` (`npm run typecheck`)                                    |
| Build                            | Vite 8.3.4; o HTML é montado no build a partir de `content/` (YAML com JSON Schema)                                          |
| 3D                               | three.js 0.184.0 aparado (`build/three-compartilhado.js`), cena num Web Worker com `OffscreenCanvas`                         |
| Backend, banco, login, pagamento | nenhum                                                                                                                       |
| Publicação                       | GitHub Pages, por GitHub Actions                                                                                             |
| Medição                          | Umami Cloud, sem cookies, pelo próprio JS da página (`src/analytics.js`)                                                     |
| Tamanho                          | cerca de 7.100 linhas de JS (`src/`, `build/`, configs), `index.html` com 1.813 linhas (quase só CSS) e 36 arquivos de teste |

**Superfície de confiança.** O visitante não envia nada ao site: não há formulário, cookie nem storage. O que
vem de fora é o conteúdo de `content/` (escrito pelo dono e validado por schema no build) e dois parâmetros
da URL (`utm_source` e `utm_campaign`), que só entram no texto do WhatsApp se forem letras, números, `.`,
`_` ou `-`, com até 40 caracteres (`src/main.js:210-213`). Por isso M1 e M3 são de superfície mínima, como a
skill prevê para `marketing-site`.

## Fase 1: verificadores determinísticos

| Verificador                           | Estado                  | Resultado                                                                                                                                                                                                 |
| ------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| semgrep                               | não instalado           | pulado                                                                                                                                                                                                    |
| gitleaks                              | não instalado           | trocado por varredura manual de padrões de chave (AWS, chave privada, GitHub, Slack, OpenAI, Google, JWT) em todo arquivo versionado e nos nomes de arquivo do histórico: **0 achados**                   |
| Auditoria de dependências (npm audit) | não rodou, de propósito | ela manda a árvore de dependências ao registro do npm, e a regra do projeto é não enviar nada dele a serviço externo. O Dependabot faz essa conferência no GitHub toda segunda (`.github/dependabot.yml`) |
| ESLint e Prettier (`npm run lint`)    | rodou                   | 0 erro, 0 aviso                                                                                                                                                                                           |
| TypeScript (`npm run typecheck`)      | rodou                   | 0 erro                                                                                                                                                                                                    |
| Build e orçamento de bytes            | rodou                   | todos os tetos cumpridos (tabela no M2)                                                                                                                                                                   |

Ao começar, a árvore de trabalho tinha uma alteração solta em `build/render.js`: a chave `email` repetida no
objeto do rodapé, que derrubava o `npm run lint` (regra `no-dupe-keys`). O `HEAD` estava certo, e a
alteração foi desfeita antes da auditoria. Ver o M5.

## Módulos

- [x] M1 Saúde do código e segurança (superfície mínima)
- [x] M2 Arquitetura e performance
- [x] M3 Jornada do cliente (superfície mínima)
- [x] M4 Conversão e texto
- [x] M5 Minas escondidas
- [x] M6 Briefing do dono e as 3 prioridades

## O veredito

A rodada 1 acertou o tom e errou o endereço. Das 20 referências com número de linha que ela fez, 7 apontam
para o trecho errado (o `src/render/worker.js` tem 12 linhas e ela citou da 1 à 60) e 3 afirmam o que o
código não diz. Também disse que a trava do 3D "quebra o build" e impede mexer nos cartões de produto,
quando ela derruba um teste e nem cobre `src/produtos/`. Pela regra número 1 da própria skill, esses achados
teriam sido descartados.

O que importa agora: a Fase A fez o que só código resolve (6 defeitos de layout medidos, a 404 em subpasta,
o rodapé, a documentação, a esteira de logos) e nenhum teto de bytes subiu. Tecnicamente, a página está
muito acima de qualquer site institucional do setor. O problema mudou de lugar e não está mais no código: em
production a página vai ao ar **sem nenhuma prova social** (zero depoimento, zero nota, e a seção de
clientes some), e a resposta à prioridade 1 da rodada 1, o e-mail, foi entregue pela metade: existe no
schema e no rodapé, mas não há e-mail no conteúdo, o clique não é medido e ele não aparece justamente onde
o WhatsApp falha. Linha de montagem de fábrica de foguete, vitrine sem cliente.

## Comparativo com a rodada 1

### Notas

| Rodada 1                          | Nota R1 | Rodada 2                       | Nota R2 | O que mudou                                                                                                                                              |
| --------------------------------- | :-----: | ------------------------------ | :-----: | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 02. Segurança e chaves expostas   |   9,5   | M1 Saúde do código e segurança |   9,0   | escopo maior (inclui saúde do código). Lint e tipos zerados; perde pelo teste de conteúdo afrouxado e pelo e-mail sem validação de formato               |
| 03. Arquitetura e teto de escala  |   8,0   | M2 Arquitetura e performance   |   8,5   | o teto da visita desceu de 181,5 para 180,4 KB; a Fase B do 3D vem logo depois deste relatório. Continua sem medição em aparelho real                    |
| 04. Fluxo do cliente              |   6,5   | M3 Jornada do cliente          |   7,5   | 6 defeitos de layout corrigidos (notebook, tablet em pé, celular, rodapé, 404). A rodada 1 tirava nota pelo tour, que é decisão do dono e aqui não conta |
| 05. Crescimento e conversão       |   7,0   | M4 Conversão e texto           |   7,0   | o e-mail virou opção no código, mas não está preenchido nem é medido; a prova social continua zero em production                                         |
| 01. The Roast                     |   7,5   | (virou o veredito, sem nota)   |    -    | -                                                                                                                                                        |
| (não existia)                     |    -    | M5 Minas escondidas            |   7,0   | módulo novo                                                                                                                                              |
| Nota geral (pesos não explicados) |   7,7   | Média simples de M1 a M5       |   7,8   | -                                                                                                                                                        |

### O que a rodada 1 afirmou e não confere

| Afirmação da rodada 1                                                                   | O que o código diz                                                                                                                                                                                                                                                                                             | Situação      |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `tests/brand.test.mjs:186-195` barra `<foreignObject>`, `<use>` externo e eventos `on*` | a expressão (`tests/brand.test.mjs:190`) barra `<text`, `<image`, `<filter`, `<style`, `<metadata`, `<script` e efeitos; não olha `foreignObject`, `use` nem `on*`. Quem barra SVG de fora é `build/validate.js:95-102`, para os logos de clientes, que além disso entram como `<img>` (`build/render.js:283`) | não confere   |
| O gatilho dos produtos tem margem de 400 px (`src/produtos/gatilho.js:1-45`)            | o arquivo tem 35 linhas e a margem é `300px 0px` (`src/produtos/gatilho.js:32`)                                                                                                                                                                                                                                | não confere   |
| A `og.jpg` pesa 65 KB, o teto do teste (`tests/orcamento.test.mjs:54`)                  | pesa 62.984 bytes (61,5 KB), abaixo do teto de 65 KB                                                                                                                                                                                                                                                           | não confere   |
| A trava do 3D "trava a geometria" e qualquer ajuste "quebra o build"                    | ela compara o sha256 dos arquivos-fonte de `src/scene/`, `src/render/` e `tests/scene.test.mjs` (`tests/trava-3d.test.mjs:15-27`); derruba um teste, não o build                                                                                                                                               | não confere   |
| A trava "impede melhorias nos cartões de produto"                                       | `src/produtos/` não está na trava                                                                                                                                                                                                                                                                              | não confere   |
| A cena roda "a 60 fps cravados"                                                         | nunca foi medido: todos os testes rodam com WebGL por software (seção 7 do relatório do 3D)                                                                                                                                                                                                                    | sem evidência |
| UTM em `src/main.js:125-135`                                                            | está em `src/main.js:210-215`; o risco de "truncar a mensagem em webviews antigas" não tem caso: cada valor tem no máximo 40 caracteres simples                                                                                                                                                                | linha errada  |
| Worker em `src/render/worker.js:1-60`; reserva em `src/render/controller.js:1-50`       | o worker tem 12 linhas; a decisão de cair para a thread principal está em `src/render/stage.js:86-88`                                                                                                                                                                                                          | linha errada  |
| Autoplay em `src/main.js:80-95`                                                         | está em `src/main.js:169-202`                                                                                                                                                                                                                                                                                  | linha errada  |
| Botão do cabeçalho escondido em `index.html:1600-1635`                                  | está em `index.html:1366-1370` (as linhas citadas são os cartões da história)                                                                                                                                                                                                                                  | linha errada  |
| Barra do WhatsApp a partir do capítulo 2 em `src/story.js:40-60`                        | está em `src/story.js:72`                                                                                                                                                                                                                                                                                      | linha errada  |
| JSON-LD em `build/render.js:100-140`                                                    | está em `build/render.js:208-237`                                                                                                                                                                                                                                                                              | linha errada  |
| No celular "o usuário depende de encontrar o link no meio do primeiro cartão"           | o `tests/layout.test.mjs:166` confere em todas as telas testadas que o título, o botão e a região aparecem sem rolar                                                                                                                                                                                           | exagero       |
| Web Vitals vão "diretamente" ao Umami; o A/B "permite testar"                           | os Web Vitals vão dentro do único `visit_summary` (`src/analytics.js:76-95`); o experimento `quote_wizard` está desligado (`site.config.js:75`)                                                                                                                                                                | impreciso     |

O texto da rodada 1 também está sem acento ("Relatorio", "seguranca"), o que nenhum teste pega: o
`tests/docs.test.mjs` só confere travessão.

### O que a rodada 1 recomendou e o que aconteceu

| Recomendação                                                 | Situação                                                                                                                                                                                                                              |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Quebrar a monocultura do WhatsApp (e-mail)                | **feito em parte** (`77a09bd`): campo opcional no schema, linha no rodapé e `email` no JSON-LD. Falta o e-mail real, a validação, a medição e a oferta onde o WhatsApp falha (M3, M4 e M5)                                            |
| 2. Desligar o autoplay do tour                               | **recusado pelo dono**: o tour fica, rolando a página. O código cumpre as salvaguardas (M3)                                                                                                                                           |
| 3. Fase B do 3D e trocar a trava por paridade com tolerância | a Fase B é executada logo depois deste relatório. A troca da trava **não** é recomendada: a paridade pixel a pixel contra a master já roda no CI, a trava é só um alarme de revisão, e o relatório do 3D (seção 6) recomenda mantê-la |

## M1 Saúde do código e segurança: 9,0

**Pontos fortes, conferidos:**

- CSP sem `unsafe-inline`: cada `<style>` entra pelo hash e o único domínio externo é o da medição
  (`build/csp.js:9-20`), com `object-src 'none'`, `base-uri 'self'` e `form-action 'none'`.
- Todo texto de `content/` passa por um único `escapeHtml` (`build/texto.js:19`).
- Logo de cliente (que vem de terceiro) só entra se for SVG sem script, sem `on*=`, sem `javascript:`, sem
  imagem embutida e sem carregar nada de fora (`build/validate.js:95-102`), passa pelo svgo e é mostrado
  como `<img>`, onde SVG não executa nada (`build/render.js:283`).
- O `.env` é versionado de propósito e só pode ter as 5 chaves públicas `VITE_*`: o
  `tests/data-source.test.mjs:27` derruba qualquer chave a mais, e o `.env.example:3` avisa que nada ali é
  segredo.
- CI com cada ação fixada pelo hash do commit e permissão mínima: `contents: read` em tudo
  (`.github/workflows/ci.yml:12-13`) e `pages: write` só no job que publica, que não instala nada
  (`.github/workflows/deploy.yml:49-51`). Dependabot semanal com 7 dias de carência.
- O único `innerHTML` do código põe um texto fixo, sem dado de fora (`src/wizard.js:160`).

**Achados:**

1. **MÉDIO: e-mail sem validação de formato** (`content/schemas/empresa.schema.json:24-28`). O campo aceita
   qualquer texto de até 80 caracteres. Um erro de digitação ("contato@vanpack" ou "contato vanpack.com.br")
   passa pelo build de production e publica um `mailto:` quebrado no rodapé e um `email` inválido no
   JSON-LD. Correção: `"pattern": "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$"` no schema.
2. **BAIXO: teste de conteúdo afrouxado** (`tests/conteudo.test.mjs:25`). Para liberar o rodapé, o `77a09bd`
   apagou a proibição de e-mail da página inteira, em vez de liberar só o campo do rodapé e o JSON-LD. Hoje
   nada impede um e-mail de entrar numa mensagem do WhatsApp ou num cartão da história. Correção: voltar a
   regra com exceção para o `<dd>` de `.f-email` e para o JSON-LD.
3. **BAIXO: o hook de pre-push existe e não está instalado nesta máquina** (`.githooks/pre-push`;
   `git config core.hooksPath` vazio). Foi o que deixou a chave `email` repetida na árvore sem aviso.
   Correção: `npm run hooks:instalar` uma vez.

## M2 Arquitetura e performance: 8,5

**Pontos fortes, conferidos:**

- A cena roda num Web Worker com `OffscreenCanvas` (`src/render/stage.js:25`) e cai para a thread principal
  quando o worker não serve (`src/render/stage.js:86-88`); sem WebGL, fica o fundo com o símbolo.
- Um único three.js aparado serve os dois workers e o render de reserva; o script da página não leva
  three.js (teste em `tests/orcamento.test.mjs:124-128`).
- O 3D dos produtos só é baixado perto da seção (`src/produtos/gatilho.js:32`), é desenhado só à vista e,
  longe de todos os cartões, o worker libera a GPU e é encerrado.
- Cada arquivo tem teto de bytes e os tetos só descem (`tests/orcamento.test.mjs:39-63`).

**Bytes medidos agora** (gzip nível 9, como o teste mede; Node 26):

| O quê                                   |   Bytes |    Teto | Folga |
| --------------------------------------- | ------: | ------: | ----: |
| JS inicial (página + worker + three.js) | 133.895 | 134.144 |   249 |
| `three`                                 | 114.256 | 114.585 |   329 |
| `worker` (a cena)                       |  11.690 |  11.878 |   188 |
| `controller` (render de reserva)        |  11.764 |  11.878 |   114 |
| `produtos-worker`                       |   7.567 |   7.680 |   113 |
| `montar`                                |   1.930 |   2.048 |   118 |
| `index.html`                            |  10.952 |  11.673 |   721 |
| Carga inicial                           | 174.474 | 175.308 |   834 |
| Visita completa                         | 183.971 | 184.729 |   758 |

**Achados:**

1. **MÉDIO: nunca medido em aparelho real.** Quadros por segundo no celular, Safari no iPhone e Firefox
   nunca foram abertos; todo número de performance do projeto vem de WebGL por software. A qualidade
   adaptativa da cena foi calibrada por raciocínio. O roteiro de medição está na seção 7 do relatório do 3D.
2. **BAIXO: o three.js é 85% do JS inicial** (114.256 de 133.895 bytes) e o 3D principal não consulta
   `saveData`, `deviceMemory` nem a rede, ao contrário do 3D dos produtos (`src/produtos/montar.js:20-33`).
   Decisão pendente do dono (relatório do 3D, seção 8, item 2).
3. **BAIXO: código repetido no 3D:** a textura em canvas copiada três vezes, o laço das letras de "SUA
   MARCA" duas vezes, a densidade com duas chaves iguais (`src/produtos/montar.js:12`) e o critério de
   celular copiado entre `src/render/stage.js` e `src/produtos/montar.js:8` sem teste que trave as cópias.
   É exatamente a Fase B, que vem logo depois deste relatório.

## M3 Jornada do cliente: 7,5

**O caminho, lido do código:** a página abre com o título, o botão do WhatsApp e a região à vista
(`index.html:1582-1583`); o tour começa no instante em que a cena fica pronta (`src/main.js:196-202`) e
para no fim da história; no celular a barra do WhatsApp entra no 2º capítulo (`src/story.js:72`); depois vêm
produtos, diferenciais, clientes e o CTA final, com "Prefere ligar?" (`index.html:1707-1710`). Se a página
continua à vista 2,5 s depois do toque no WhatsApp, sobe a folha "O WhatsApp não abriu?"
(`src/handoff.js:6`).

**Pontos fortes, conferidos:**

- Título, botão e região sem rolar em todas as telas testadas (`tests/layout.test.mjs:166`).
- O tour respeita quem chega: qualquer toque, roda, tecla ou rolagem interrompe e ele nunca retoma sozinho
  (`src/tour.js:125-146`); movimento reduzido o desliga (`src/main.js:146-148`); `?tour=0` também; e o
  console diz por que ele não começou (`src/main.js:169-178`).
- Dentro do Instagram, Facebook ou TikTok, a folha ensina a abrir no navegador, e o código de origem ganha o
  sufixo do app para medir onde o WhatsApp mais falha (`src/main.js:220-224`).

**Achados:**

1. **MÉDIO: o e-mail não aparece onde o WhatsApp falha.** A folha "O WhatsApp não abriu?"
   (`index.html:1788-1809`) oferece copiar o número e ligar; o CTA final oferece ligar
   (`index.html:1707-1710`). O comprador de empresa com WhatsApp bloqueado no computador, o motivo de o
   e-mail existir, cai exatamente nesses dois lugares e não vê o e-mail; só o encontra no rodapé. Correção:
   um link `mailto:` com `data-need="email"` nos dois lugares (some sozinho sem e-mail, como o telefone).
2. **MÉDIO (Fase B): o cartão do 3D dos produtos é lido duas vezes pelo leitor de tela e diz "girando"
   depois de parar.** A área e o canvas recebem o mesmo nome (`src/produtos/montar.js:147-148` e
   `src/produtos/montar.js:227`), e ao ligar o movimento reduzido só o nome do canvas é refeito
   (`src/produtos/montar.js:247-250`). Corrigido no commit B2, logo depois deste relatório.
3. **BAIXO: a política de privacidade não oferece o e-mail** para os pedidos da LGPD
   (`content/privacidade.md:9` e `content/privacidade.md:39`): só WhatsApp e telefone. Quem não usa
   WhatsApp fica sem canal escrito. Correção: um `{{#se email}}` nas duas frases.

## M4 Conversão e texto: 7,0

**Pontos fortes, conferidos:**

- A promessa é clara e concreta: "Caixas de papelão sob medida, com a sua marca"; o CTA final diz o que
  mandar (C x L x A, quantidade, impressão) e acolhe quem não tem a medida ("mande a foto do produto")
  (`content/historia.yaml`, `content/orcamento.yaml`).
- Cada produto tem a sua mensagem pronta (`content/produtos.yaml`) e cada botão leva o código de origem
  `[site-<cta>]` e a campanha (`src/main.js:204-215`): o dono vê de onde veio cada conversa sem cookie.
- A infraestrutura de teste A/B existe e está desligada (`site.config.js:75`). Com o tráfego de um site
  regional, um teste não chegaria a resultado confiável: desligado está certo.

**Achados:**

1. **ALTO: zero prova social em production.** Sem depoimento e sem nota (`content/provas.yaml:27-28`), e o
   único cliente da faixa de logos não está autorizado (`content/clientes.yaml:26`), então a seção
   `#clientes` e o link para ela somem em production. Comprador de empresa raramente fecha lote com fábrica
   que não mostra nenhum cliente. Depende do dono: autorizações registradas em `docs/provas/`.
2. **MÉDIO: o clique no e-mail não é medido.** O rodapé marca o link com `data-contact="email"` e o
   `src/main.js:247-254` gera `email_click`, mas a lista do que vai ao Umami (`src/analytics.js:24-31`) não
   inclui esse evento: ele fica só no `dataLayer`, que nada lê. Ninguém vai saber se o e-mail traz pedido.
   Correção: `email_click` na lista e "e-mail" na frase da medição da política
   (`content/privacidade.md:18`).
3. **BAIXO: "Por que a Vanpack" repete a história** e as formas de pagamento, que existem nos dados
   (`content/empresa.yaml:41`), não aparecem em lugar nenhum. As objeções reais de quem compra (forma de
   pagamento, nota fiscal, que arquivo de arte mandar) ficam sem resposta. Depende de texto do dono (plano
   geral, item 4.2).

## M5 Minas escondidas: 7,0

1. **MÉDIO: a margem do JS inicial no CI é de uns 90 bytes.** Aqui (Node 26) a folga é de 249 bytes; o CI
   roda Node 24, cujo gzip sai uns 160 bytes maior no mesmo arquivo (`tests/orcamento.test.mjs:8-10`). Uma
   mudança na cena que passa aqui pode reprovar no CI. Correção: medir a folga contra o Node 24 antes de
   todo push que mexa em `src/scene/`, `src/render/` ou `src/main.js`.
2. **MÉDIO: o e-mail ficou pela metade.** Resumo do M1, M3 e M4: `content/empresa.yaml` não tem a linha
   `email` nem um exemplo comentado (o README diz que ela existe), o `docs/go-live.md` não a cita, o schema
   não valida o formato, o clique não é medido e a folha de ajuda não o oferece. Do jeito que está, o recurso
   fica desligado no go-live sem ninguém perceber.
3. **BAIXO: alteração solta na árvore de trabalho.** Um agente deixou `build/render.js` com a chave `email`
   repetida depois do commit `77a09bd`; sem o hook de pre-push instalado (M1), ela iria até o CI. Desfeita
   antes desta auditoria; a cópia do diff ficou fora do repositório.
4. **BAIXO: a trava do 3D não cobre arquivo novo** (`tests/trava-3d.test.mjs:3`): só os 15 arquivos
   listados no fixture são conferidos. Um arquivo novo em `src/scene/` entra sem alarme até a trava ser
   refeita.
5. **BAIXO: tipos do Node à frente do Node do CI:** `@types/node` 26 no `package.json` e Node 24 no
   `.nvmrc` (plano geral, item 5.5). Nenhum caso concreto visto.
6. **BAIXO, não verificado: o resumo da visita pode se perder no celular**: ele sai num `setTimeout` quando
   a aba some (`src/analytics.js:117-122`), e o celular pode congelar a página antes. Conferir no Umami
   depois do go-live (plano geral, item 9.3).
7. **INFO: cota do Umami.** O plano grátis tem 100 mil eventos por mês e o site manda uns 5 por visita
   (`src/analytics.js:20-23`): cerca de 20 mil visitas por mês antes de o servidor pedir para parar, o que o
   código já respeita (`src/analytics.js:70`).

## M6 Briefing do dono

A engenharia está pronta para o go-live e não é ela que vai decidir se a página vende. Segurança, build,
testes e orçamento de bytes estão num nível raro para um site institucional, e a Fase A fechou os defeitos
de layout que um visitante veria. As duas decisões grandes do dono, o tour que toca sozinho e o WhatsApp
como canal principal, estão implementadas com as salvaguardas certas: o tour cede a qualquer toque e
respeita o movimento reduzido, e o WhatsApp tem uma folha de socorro quando não abre.

O que falta é confiança. Um gerente de compras que chega pela busca vê uma animação bonita de uma fábrica
que ele não conhece, sem um cliente, um depoimento ou uma nota. Esse é o maior custo hoje e não se resolve
com código: são três autorizações por escrito. O e-mail, criado para o comprador que não usa WhatsApp no
trabalho, está a meio caminho: precisa do endereço real, de aparecer onde o WhatsApp falha e de ser medido,
senão em três meses não vai haver dado para dizer se ele valeu a pena.

O terceiro risco é o que ninguém viu: a primeira impressão da página é um 3D que nunca rodou num celular de
verdade. Se ele engasgar num Android de entrada, quem chega pelo celular sai antes de ler o título.

## As 3 prioridades

1. **ALTO: prova social antes do go-live** (`content/provas.yaml:27-28`, `content/clientes.yaml:26`). Em
   production a página não mostra nenhum cliente, depoimento ou nota, e a seção de clientes some com o seu
   link. Para compra de empresa, que envolve aprovação e risco de fornecedor, isso pesa mais que qualquer
   detalhe visual: é a diferença entre "fábrica desconhecida" e "fábrica que atende quem eu conheço". O
   mecanismo já existe e espera dado. **Correção:** registrar em `docs/provas/` a autorização de pelo menos 3
   clientes e 2 depoimentos e preencher `content/clientes.yaml` e `content/provas.yaml`.
2. **MÉDIO: fechar o circuito do e-mail** (`src/analytics.js:24-31`, `index.html:1788-1809`,
   `content/schemas/empresa.schema.json:24-28`). O e-mail existe para o comprador sem WhatsApp, mas não está
   preenchido, não é validado, não é medido e não aparece onde o WhatsApp falha. Sem medição, não haverá
   como saber se ele traz pedido; sem validação, um erro de digitação publica um link quebrado.
   **Correção:** e-mail real em `content/empresa.yaml` com `pattern` no schema, `email_click` na lista do
   Umami (e na política), e o `mailto:` com `data-need="email"` na folha de ajuda e ao lado do "Prefere
   ligar?".
3. **MÉDIO: medir o 3D em aparelho real** (`src/render/stage.js:86-88`; relatório do 3D, seção 7). Toda
   medida de performance do projeto vem de WebGL por software; Safari no iPhone e Firefox nunca abriram a
   página. A cena é a primeira coisa que o visitante vê. **Correção:** `npm run build && npm run preview --
--host`, um Android de entrada e um iPhone pela rede local, quadros por segundo anotados por capítulo,
   e depois do go-live o `scene` do `visit_summary` no Umami.

## O que esta rodada não fez

- O modo de URL ao vivo da skill (`--url`, com navegador e PageSpeed): não houve chamada de rede.
- Leitor de tela de verdade, Safari e Firefox: não existem nesta máquina.
- O CTA de upgrade que a skill põe no fim não se aplica a este projeto.

Tempo de relógio desta rodada: cerca de 15 minutos, da leitura ao relatório.

## Adendo: a suíte inteira no commit avaliado

Esta rodada rodou lint, tipos, build e bytes, mas não o `npm test` inteiro. Rodado depois, no fim da Fase B,
ele mostrou 5 falhas que já existiam no commit avaliado (`77a09bd`). Todas eram dos testes, nenhuma do site,
e duas reprovariam o CI em qualquer push:

| Falha                                           | Desde                            | Causa                                                                                                       | Corrigido em |
| ----------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------ |
| Diferenciais, em `tests/content.test.mjs`       | `a2e8315`                        | o teste esperava o erro de ícone fora da lista, e o ícone saiu do schema                                    | `bb64dd2`    |
| 404 em subpasta, em `tests/subcaminho.test.mjs` | `3f83f18`, quando o teste nasceu | o 404 do próprio documento contava como erro de console                                                     | `b7dd65c`    |
| Respiro do logo, em `tests/brand.test.mjs`      | antes da Fase A (`e747779`)      | corrida: o teste media o símbolo do carregamento já transparente; num computador lento, como o do CI, passa | `04a00ef`    |

Isso entra no M5 como **ALTO**, já corrigido: a branch não passaria no CI. Ficam ainda:

- **Pendência de design para o dono.** Desde o cartão da abertura de 44rem (`0ee80d8`), o símbolo do
  carregamento, que também é o fundo sem WebGL e o da perda de contexto, fica atrás do cartão em 12 de 14
  telas medidas (de 320×568 a 1920×1080); só aparece em celular alto e no tablet em pé, e em 390×844 a 14,9
  px do título (o manual pede 20).
- **BAIXO: um teste sensível a carga.** "Clicar na faixa com o mouse não deixa a esteira parada", em
  `tests/carrossel.test.mjs`, mede a esteira andando em 1 s; numa rodada inteira ele falhou uma vez e passou
  5 de 5 isolado.
