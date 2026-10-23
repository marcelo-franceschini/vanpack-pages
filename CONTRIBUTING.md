# Como contribuir

Este guia é para quem mexe no repositório. Quem só edita textos, clientes e dados da empresa deve ler
a seção "Como editar o conteúdo (sem programar)" do [README](README.md): basta alterar os arquivos de
[`content/`](content/), sem tocar em código.

## Preparação

```bash
nvm use            # Node 24 (arquivo .nvmrc); o mínimo aceito é o 22.12
npm ci
npm run dev        # servidor de desenvolvimento; mexer em content/ recarrega a página
npm run hooks:instalar   # opcional: antes de cada push roda lint e tipos (uns 5 s), sem dependência
```

Os testes de navegador usam o Chrome do sistema (`CHROME_PATH`, padrão `/usr/bin/google-chrome-stable`).

## Fluxo de trabalho

1. Parta da `master` atualizada e crie uma branch (`feat/...`, `fix/...`, `perf/...`, `chore/...`).
2. Faça commits pequenos, **um assunto por commit**, no padrão
   [Conventional Commits](https://www.conventionalcommits.org/pt-br/) **em português**:
   `feat(conteudo): clientes em content/clientes.yaml`, `fix(a11y): o foco não fica atrás do botão`,
   `perf(3d): three.js num arquivo só`. O corpo do commit explica o porquê.
3. Antes de abrir o pull request, rode o que o CI roda:

   ```bash
   npm run lint        # ESLint + Prettier
   npm run typecheck   # tsc --checkJs (JSDoc) em build/, site.config.js e src/ (menos os erros do 3D travado)
   npm test            # build + testes (leva uns 9 minutos)
   ```

4. Abra o pull request para a `master`. O CI (`verificar`, que roda lint, tipos e os testes em 3 partes
   paralelas, e `paridade`) precisa estar verde; o job `lighthouse` fica vermelho se LCP, TBT ou CLS passarem do teto, mas não bloqueia o merge enquanto não for check obrigatório da `master`. O merge publica o
   site sozinho (GitHub Pages, por Actions) depois de os testes passarem de novo.

Nunca faça push direto na `master`: ela é protegida (os checks `verificar / verificar` e `paridade` são
obrigatórios; force-push e exclusão são recusados).

## Versionamento e como desfazer

- O histórico é o changelog: commits pequenos no padrão acima e, em cada PR, a tabela "commit, o que muda,
  métrica antes e depois". Não há releases nem `CHANGELOG.md`: o site é de entrega contínua.
- Ao ir ao ar com dados reais (`docs/go-live.md`), ponha uma tag no commit do merge, como ponto de retorno
  conhecido: `git tag -a go-live-AAAA-MM-DD -m "Site no ar com dados reais"` e `git push origin --tags`.
- Para desfazer um merge ruim: `git revert -m 1 <commit do merge>` num PR; o merge do revert publica de
  novo o site anterior (uns 8 minutos). Enquanto isso o site que está no ar não é derrubado.

## O que não pode mudar sem combinar antes

- **O visual.** Layout, arte e 3D são congelados: o que o visitante vê tem de ficar igual. O CI roda
  `npm run audit:paridade`, que compara, pixel a pixel, o site do PR com o da `master` em 6 tamanhos de
  tela (1440×900, 1366×768, 924×540, 720×450, 390×844 e 844×390) e a estrutura do HTML. Se a mudança
  visual for de propósito, ponha o rótulo **`muda-visual`** no PR (as imagens que mudaram ficam como
  artefato do CI para revisão). Se só o HTML mudar (por exemplo, uma correção de acessibilidade que o
  visitante não vê), o rótulo é **`muda-html`**; explique a diferença na descrição do PR.
- **O 3D principal.** `src/scene/`, `src/render/` e `tests/scene.test.mjs` são travados por hash
  (`tests/trava-3d.test.mjs` e `tests/fixtures/3d-lock.json`). Mexer neles é decisão do dono do projeto.
- **O tour automático.** Ele começa sozinho, sem espera, assim que a cena fica pronta (ver README).
- **Os orçamentos de desempenho.** O JS inicial não passa de 131 KB gzip, e `tests/orcamento.test.mjs`
  trava os bytes por arquivo: os tetos só descem. Nunca afrouxe um teto nem altere um teste para fazê-lo
  passar; se um teste falha, entenda a causa.
- **A marca.** Só as cores Floresta, Carvão, Papel e Kraft; só a fonte Archivo; sem foto; sem
  formulário; sem PWA; sem cookies nem banner; nenhuma promessa de tempo de resposta e nenhum número ou
  alegação inventados. Detalhes em [`docs/manual-da-marca.md`](docs/manual-da-marca.md).

## Regras de escrita

- Textos, comentários, commits e documentos em português do Brasil.
- **Sem travessão longo nem meio travessão** (os traços compridos) em nenhum texto: use dois-pontos,
  vírgula, ponto ou hífen. O build recusa em `content/`, e `tests/docs.test.mjs` confere README, CONTRIBUTING, LICENSE e `docs/`.
- Texto de negócio mora em `content/`, nunca no `index.html` nem no código (`tests/template.test.mjs`
  prova isso). Os dados da empresa vêm de `content/empresa.yaml`.
- Sem dependência de execução nova (`dependencies`): o navegador recebe `three` e `web-vitals` e mais nada.
  Ferramenta de desenvolvimento (`devDependencies`) só com justificativa na descrição do PR.

## Dados e go-live

O site nasce em modo `demo` (dados fictícios e `noindex`). A passagem para `production` tem uma trava no
build e um passo a passo em [`docs/go-live.md`](docs/go-live.md).
