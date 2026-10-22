# Vanpack: Embalagens de Papelão Ondulado

Landing page oficial da **Vanpack** (caixas de papelão sob medida, divisórias e chapas, fábrica em Santo André-SP). Uma página, uma ação: pedir orçamento pelo WhatsApp, atendido por um assistente. No topo, uma cena 3D ligada ao scroll (a fabricação de uma caixa, da chapa ao caminhão) acompanha 5 cartões que falam do que importa a quem pede: a chamada, anos de mercado, qualidade, orçamento e entrega. A página rola sozinha (tour automático) e a pessoa assume o controle a qualquer momento.

- **Manual da marca e diretrizes:** [`docs/manual-da-marca.md`](docs/manual-da-marca.md).
- **3D de cada produto** (referência, decisões e como funciona): [`docs/produtos-3d.md`](docs/produtos-3d.md).
- **Contratos, faixas do scroll, tokens e decisões da v4:** [`docs/notas-de-integracao-v4.md`](docs/notas-de-integracao-v4.md).
- **Slogan:** "Do projeto à entrega".
- **Passo a passo para ir ao ar com dados reais:** [`docs/go-live.md`](docs/go-live.md).
- **Experimentos A/B** (regras, métrica, amostra e como ligar): [`docs/experimentos.md`](docs/experimentos.md).
- **Assets oficiais em vetor:** [`public/brand/`](public/brand/).
- **Como contribuir** (fluxo de PR, commits, o que é travado): [`CONTRIBUTING.md`](CONTRIBUTING.md). **Licença:** [`LICENSE`](LICENSE) (todos os direitos reservados).

---

## Comandos

Node.js 24 (arquivo `.nvmrc`; o mínimo aceito é o 22.12). Os testes e as auditorias usam o Chrome do sistema (`CHROME_PATH`, padrão `/usr/bin/google-chrome-stable`) com WebGL por software.

```bash
npm install
npm run dev            # servidor de desenvolvimento
npm run build          # gera dist/ (CSP por hash, workers da cena, three.js num arquivo só, SVGs e fonte)
npm run build:audit    # build de auditoria em dist-audit/ (expõe contadores do renderer)
npm run preview        # serve o dist/ localmente
npm run lint           # ESLint + Prettier (o mesmo do CI)
npm run typecheck      # tipos por JSDoc (tsc --checkJs) em build/, site.config.js e src/ (inclusive main.js e o 3D dos produtos), sem converter nada para .ts; src/scene/ e src/render/ (travados por hash) só entram por serem importados e os erros deles não contam
npm run format         # formata tudo com o Prettier
npm test               # build + build de auditoria + testes de navegador (Playwright), em fila
PARTE=1 npm run test:parte   # só a 1ª de 3 partes da suíte (é o que o CI roda em paralelo; PARTE=2 e PARTE=3 são as outras)
npm run hooks:instalar # opcional: pre-push que roda lint e tipos antes de cada push
```

Auditorias (medem; os orçamentos estão no cabeçalho de cada script):

```bash
npm run audit:bundle      # gzip/brotli por arquivo, JS inicial (≤ 132 KB gzip), visita completa, maiores módulos
npm run audit:scene       # draw calls e triângulos nos 5 centros (≤ 90 desktop, ≤ 60 celular)
npm run audit:produtos    # draw calls do 3D de cada produto (≤ 60 por modelo) e memória ao rolar (precisa do build:audit)
npm run audit:runtime     # tarefas longas e quadros ao rolar a história, com CPU 1× e 4×
npm run audit:lighthouse  # Lighthouse mobile e desktop (mediana de 3 execuções; baixa via npx)
npm run audit:carga       # celular com rede lenta (150 ms, 1,6 Mbps) e CPU 4x: FCP, LCP, tempo até a cena 3D e fila de pedidos (mediana de 11; tetos no cabeçalho)
npm run audit:capturas    # capturas da história e das seções, em docs/capturas/ (fora do git)
npm run audit:paridade    # compara com a master (ou --base=<ref>): pixels em 6 tamanhos (5 quadros, 5 seções e o 3D de cada produto) e a estrutura do HTML; diferenças em dist-paridade/
```

Manutenção da marca (rodam à mão, não fazem parte do build):

```bash
node scripts/brand.mjs   # regenera os SVGs de public/brand/, a fonte e src/brand/marks.js (precisa do uv)
node scripts/icons.mjs   # regenera favicon, apple-touch-icon e icon-512 (logo do JSON-LD) a partir do símbolo
npm run amostra -- 0.05 0.06   # tamanho de amostra por variante de um teste A/B
npm run og               # regenera public/og.jpg (imagem de compartilhamento) a partir do 1º quadro
node scripts/produtos-svg.mjs   # regenera as ilustrações dos produtos (public/produtos/), o fallback do 3D
```

---

## Seções da página

Cabeçalho fixo, a história 3D (`#processo`, com 5 cartões que nunca somem), a faixa de confiança (`#confianca`: cidade, CNPJ, "Nunca pedimos pagamento para conta de pessoa física", anos de mercado, formas de pagamento, mapa e telefone), "O que fabricamos" (`#produtos`: Corte e vinco; Divisórias, tabuleiros e separadores; Chapas de papelão ondulado, cada um com um 3D da peça girando no topo do cartão e o seu botão de orçamento, e pedido mínimo e região; o 3D só é baixado quando a seção chega perto e, em aparelho sem condição, vira uma ilustração em SVG: [`docs/produtos-3d.md`](docs/produtos-3d.md)), os diferenciais (`#diferenciais`, de `content/diferenciais.yaml`), os clientes (`#clientes`: carrossel de logos de `content/clientes.yaml` em qualquer largura, uma esteira lenta da direita para a esquerda com botão Pausar/Retomar, setas, teclado e arrasto, que fica parada e centralizada quando os logos cabem na largura; só cliente autorizado em production e exemplos em demo; e depoimentos autorizados), o CTA final (`#orcamento`) e o rodapé. As seções alternam Papel, tint e Floresta, com a onda de papelão como divisor. A página não tem e-mail, prazo, promessa de tempo de resposta nem texto sobre o processo de fabricação (o `tests/conteudo.test.mjs` confere). O botão do WhatsApp fica fixo: no desktop é redondo e aparece depois da história; em telas de até 768 px é uma barra de largura total com o telefone, que aparece já no 2º capítulo (o botão do cabeçalho sai enquanto ela está à vista); os dois somem com o CTA final à vista. Se a página continua à vista 2,5 s depois do toque num botão do WhatsApp, sobe a folha "O WhatsApp não abriu?" (`#zap-ajuda`): copiar o número, ligar e, dentro do Instagram, Facebook ou TikTok, como abrir no navegador. Cada seção sem dado (e o link para ela) some sozinha.

---

## Conteúdo e dados (`content/` e `.env`)

Os dados da empresa e todos os textos do site vivem na pasta [`content/`](content/): arquivos YAML pequenos, um por assunto, cada um com o seu JSON Schema em `content/schemas/` (o editor sublinha o erro e autocompleta). O `.env` guarda só o que muda por ambiente. [`docs/go-live.md`](docs/go-live.md) explica como trocar tudo pelos dados reais. O que não tem dado **não aparece** no HTML (nada de valor de exemplo), e nenhum desses dados é escrito à mão no código (um teste confere).

- `content/empresa.yaml`: razão social, CNPJ, WhatsApp, telefone, endereço, horário, mapa, ano de fundação (o "N anos de mercado" e o © são calculados dele, no build e de novo no navegador, então não precisam de edição anual), pedido mínimo, região e formas de pagamento. É a fonte única do rodapé, do JSON-LD, dos links do WhatsApp, do `robots.txt` e do `sitemap.xml`. O WhatsApp é obrigatório nos dois modos (`55` + DDD + número); o build nunca gera `wa.me/?text=…` sem número.
- `content/site.yaml` (nome, slogan, título e descrição da página, texto da imagem de compartilhamento e menus), `historia.yaml` (os 5 cartões da história), `confianca.yaml`, `orcamento.yaml` (a seção final), `whatsapp.yaml` (mensagem e texto de cada botão e a folha "O WhatsApp não abriu?") e `rodape.yaml`: os textos da página. Nos textos, `{{cidade}}` puxa um dado da empresa e `{{#se cidade}}...{{/se}}` só aparece se houver o dado (a lista de variáveis está na mensagem de erro de uma variável errada). O `index.html` só tem a estrutura e `{{arquivo.campo}}` no lugar de cada texto; um teste (`tests/template.test.mjs`) prova que nenhum texto de negócio ficou escrito à mão nele nem no `build/render.js`. Ficam no código só os rótulos de interface ("Pular para o conteúdo", "Fechar", os controles do carrossel, os `aria-label` dos menus).
- `content/privacidade.md`: o texto da política de privacidade, em Markdown mínimo (`# título`, `## seção`, parágrafos, links `[texto](https://...)`, `[texto](tel:{{telefone}})` e `[texto](wa:privacidade)`), com as mesmas `{{variáveis}}` e `{{#se}}...{{/se}}` dos outros textos (`{{#se rua cidade_uf}}` vale quando todas têm valor). HTML escrito à mão, título `###` ou outro tipo de link é erro de build. O interpretador é o `build/privacidade.js` (sem dependência).
- `content/produtos.yaml`, `diferenciais.yaml` (até 6; ícone `fabrica`, `lotes`, `conversa` ou `caixa`), `clientes.yaml` e `clientes/` (até 12; logo só em SVG, até 20 KB, que o build otimiza com o svgo; em production só aparece o cliente com `autorizado: true`, que precisa de registro em [`docs/provas/`](docs/provas/README.md)) e `provas.yaml` (depoimentos e nota do Google, só autorizados). Seção sem item some, junto com o link para ela.
- `content/exemplo/empresa.yaml`: os valores fictícios de referência. Em production o build recusa um valor de `empresa.yaml` que ainda seja igual ao daqui (cidade, UF e ano de fundação ficam de fora: já são reais).
- `.env`: `VITE_DATA_MODE` (`demo`: dados fictícios, o HTML sai com `noindex` e o `robots.txt` bloqueia tudo; `production`: o build falha se faltar dado obrigatório, se o formato for inválido, se sobrar valor fictício ou cliente de exemplo), `VITE_SITE_URL` (termina em `/`: canonical, Open Graph, JSON-LD, robots e sitemap) e a medição sem cookies: `VITE_ANALYTICS_PROVIDER` (`umami` ou vazio), `VITE_ANALYTICS_SITE` e `VITE_ANALYTICS_ENDPOINT`. O [`.env.example`](.env.example) comenta cada chave.

No build, o `build/content.js` lê e valida `content/` contra os schemas (erro em português, com arquivo, linha e campo), o `site.config.js` monta a config (`createSiteConfig`), o `build/validate.js` confere a trava de go-live, o `build/render.js` escreve os dados no HTML (links `wa.me`, campos `data-field` do rodapé, trechos `data-need` e o texto alternativo `data-need="!chave"`, `{{variáveis}}`, produtos, diferenciais, clientes, JSON-LD e o `noindex` em demo) e o `build/files.js` gera `robots.txt` e `sitemap.xml`. `{{variável}}` vazia fora de um `data-need` é erro de build. Tudo isso roda só no build: o navegador recebe o mesmo HTML estático, sem YAML, sem validador e sem `fetch`.

---

## Como editar o conteúdo (sem programar)

Quem edita: qualquer pessoa que consiga abrir um arquivo de texto. Você **não precisa** mexer em HTML, CSS nem JavaScript: tudo que a pessoa lê no site está em `content/`. Uma analogia com Python: os arquivos `content/*.yaml` são os **dados**; os arquivos `content/schemas/*.schema.json` são os **modelos** que dizem o que é válido (o papel de um modelo Pydantic); e o `npm run build` é o script que lê os dados, valida contra os modelos e escreve o HTML final. Se algo estiver errado, o build **não publica** e diz em português o arquivo, a linha e o campo.

### O que instalar (uma vez)

1. Node.js 24 (o arquivo `.nvmrc` diz qual) e, dentro da pasta do projeto, `npm ci`.
2. O VS Code, com as extensões que ele sugere ao abrir a pasta (YAML, Prettier, ESLint). A extensão YAML sublinha o erro e autocompleta os campos, porque `.vscode/settings.json` já liga cada arquivo ao seu schema.

### As regras do YAML (cinco linhas)

- Ponha **sempre os textos entre aspas**: `titulo: "Caixas de papelão"`. Sem aspas, `:` no meio do texto, números e símbolos como `{` ou `[` no começo dão erro.
- O recuo é de **2 espaços** (nunca Tab) e cada nível de recuo é um bloco dentro do outro.
- Uma lista tem um item por linha, começando com `- `.
- Tudo depois de `#` é comentário: o site ignora.
- Campo vazio (`""`) ou apagado: o trecho some da página (nada é inventado). Os campos obrigatórios são avisados no build.

### Onde está cada coisa

| Para mudar...                                                                          | Edite                                         |
| -------------------------------------------------------------------------------------- | --------------------------------------------- |
| Telefone, WhatsApp, endereço, CNPJ, horário, mapa, ano de fundação, pedido mínimo      | `content/empresa.yaml`                        |
| Nome, slogan, título e descrição da página, texto da imagem de compartilhamento, menus | `content/site.yaml`                           |
| Os 5 cartões da história (a abertura da página)                                        | `content/historia.yaml`                       |
| A faixa "Quem somos"                                                                   | `content/confianca.yaml`                      |
| Os 3 produtos                                                                          | `content/produtos.yaml`                       |
| "Por que a Vanpack" (até 6 cartões)                                                    | `content/diferenciais.yaml`                   |
| Clientes (até 12) e seus logos                                                         | `content/clientes.yaml` e `content/clientes/` |
| Depoimentos e nota do Google (só com autorização)                                      | `content/provas.yaml`                         |
| A seção final do orçamento e os 3 passos de "Como pedir"                               | `content/orcamento.yaml`                      |
| A mensagem de cada botão do WhatsApp e a folha "O WhatsApp não abriu?"                 | `content/whatsapp.yaml`                       |
| Rótulos do rodapé                                                                      | `content/rodape.yaml`                         |
| A política de privacidade                                                              | `content/privacidade.md`                      |
| Modo demo × production, endereço do site, medição                                      | `.env`                                        |

### Passo a passo

**Trocar um texto.** Abra o arquivo da tabela, ache o texto (use a busca do editor), troque o que está entre aspas e salve. Exemplo: para mudar o título da abertura, em `content/historia.yaml`:

```yaml
hero:
  titulo: 'Caixas de papelão sob medida, com a sua marca' # troque só o que está entre aspas
```

Passe o mouse sobre um campo para ver a explicação dele e o tamanho máximo. Texto maior que o máximo é recusado, porque quebraria o layout. Os máximos foram escolhidos testando a página inteira com **todos** os textos no limite, em todos os tamanhos de tela (`tests/limites.test.mjs`). O cartão da abertura é o mais apertado: no celular deitado ele só tem 2 px de folga, por isso o título aceita 48 caracteres e a linha pequena acima dele (`Fábrica própria em {{cidade_uf}}`), já com a cidade no lugar, não pode passar de 48; o build avisa se passar.

**Trocar telefone, WhatsApp ou endereço.** Em `content/empresa.yaml`:

```yaml
whatsapp: '5511987654321' # 55 + DDD + número, só dígitos
telefone: '+551147001234' # +55 + DDD + número
telefone_exibicao: '(11) 4700-1234' # como aparece na página
endereco:
  rua: 'Av. das Caixas, 500'
  bairro: 'Distrito Industrial'
  cidade: 'Santo André'
  uf: 'SP'
  cep: '09000-100'
```

Troque aqui e pronto: o rodapé, os botões, o JSON-LD do Google e o mapa usam esses dados. Nada precisa ser mudado em outro lugar.

**Adicionar um cliente.**

1. Peça ao cliente a **autorização por escrito** (e-mail ou WhatsApp) para mostrar o logo.
2. Ponha o logo em `content/clientes/`: só **SVG** (vetor), com nome em minúsculas, sem acento e com hífens (`padaria-real.svg`), até **20 KB**, com `viewBox`, sem script nem imagem embutida. O site otimiza o arquivo ao publicar, sem mudar o desenho.
3. Em `content/clientes.yaml`, troque um dos clientes de exemplo (ou acrescente, até 12):

   ```yaml
   clientes:
     - nome: 'Padaria Real'
       logo: 'padaria-real.svg' # sem logo, aparece o nome em texto
       alt: 'Logo da Padaria Real' # opcional; sem ele, vale o nome
       autorizado: true
   ```

4. Registre a autorização em `docs/provas/padaria-real.md` (o nome do arquivo é o nome do cliente em minúsculas, sem acento e com hífens; o modelo está em [`docs/provas/README.md`](docs/provas/README.md)). Sem esse arquivo, o build recusa.

**Remover um cliente.** Apague as linhas dele (o `- nome:` e o que vem recuado embaixo) em `content/clientes.yaml`. Se quiser, apague também o SVG de `content/clientes/`. Sem nenhum cliente (nem depoimento), a seção "Clientes" e o link para ela somem sozinhos.

**Trocar uma imagem.**

- _Logo de cliente_: veja "Adicionar um cliente".
- _Imagem de compartilhamento_ (a prévia no WhatsApp e no Google): `public/og.jpg`, 1200 × 630 px, JPG, no máximo cerca de 65 KB. `npm run og` gera de novo a partir da primeira cena do 3D. Troque o texto que a descreve em `content/site.yaml` (`pagina.imagem_alt`).
- _As marcas (logo da Vanpack) e as ilustrações dos produtos_ são geradas e protegidas (manual da marca); não troque à mão.
- _Fotos_: o site não usa nenhuma (decisão do dono).

**Trocar título, descrição ou imagem de compartilhamento.** Em `content/site.yaml`, bloco `pagina`: `titulo`, `descricao` (cerca de 155 caracteres) e `imagem_alt`.

**Ver o resultado no seu computador.** `npm run dev` e abra `http://localhost:5173`. Ao salvar um arquivo de `content/`, a página recarrega sozinha. Se houver erro, aparece na tela e no terminal, por exemplo:

```text
content/clientes.yaml, linha 14 › clientes[1].logo: o arquivo content/clientes/padaria-real.svg não existe
content/historia.yaml, linha 12 › hero.titulo: tem 71 caracteres; o máximo é 48 (um texto maior quebraria o layout)
content/empresa.yaml, linha 4 › telefone: precisa ser um texto (entre aspas); você escreveu +551147001234, que o YAML leu como o número 551147001234; ponha-o entre aspas
```

Cada linha diz **o arquivo, a linha, o campo e o problema**. `npm run build` mostra os mesmos erros.

**Publicar.** (1) Salve e confira com `npm run dev` e `npm run build`. (2) `git checkout -b conteudo/minha-mudanca`, `git add content`, `git commit -m "feat(conteudo): troca o telefone"` e `git push`. (3) Abra um _pull request_ no GitHub e espere o CI ficar verde (lint, build, testes e a conferência visual). (4) Faça o _merge_: o deploy roda sozinho em poucos minutos. (5) Em **Actions**, confira que o workflow "Deploy" terminou em verde e abra o site para ver.

### Variáveis que os textos podem usar

Dentro de qualquer texto de `content/`, `{{nome}}` puxa o dado. `{{#se cidade}} Fábrica em {{cidade}}.{{/se}}` só aparece se houver cidade (`{{#se rua cidade_uf}}` vale quando todas têm valor; `{{#senao cidade}}...{{/senao}}` é o contrário). Uma variável com nome errado é recusada e o erro lista os nomes certos.

| Variável                                                                       | O que é                                                                                                                                                                         |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `{{nome}}`, `{{slogan}}`                                                       | Nome e slogan da marca (`content/site.yaml`)                                                                                                                                    |
| `{{razao_social}}`, `{{titular}}`                                              | Razão social; `titular` é a razão social ou, sem ela, o nome da marca                                                                                                           |
| `{{cnpj}}`                                                                     | CNPJ                                                                                                                                                                            |
| `{{rua}}`, `{{bairro}}`, `{{cidade}}`, `{{uf}}`, `{{cep}}`                     | Endereço, em pedaços                                                                                                                                                            |
| `{{cidade_uf}}`                                                                | "Santo André-SP"                                                                                                                                                                |
| `{{telefone}}`, `{{telefone_exibicao}}`                                        | Telefone em `+55...` e como aparece na página                                                                                                                                   |
| `{{whatsapp}}`, `{{whatsapp_exibicao}}`                                        | WhatsApp só com dígitos e como aparece: (11) 91234-5678                                                                                                                         |
| `{{horario}}`                                                                  | Horário de atendimento                                                                                                                                                          |
| `{{ano_fundacao}}`                                                             | Ano de fundação                                                                                                                                                                 |
| `{{anos}}`, `{{ano}}`, `{{ano_atual}}`                                         | Anos de mercado e ano atual, que se atualizam sozinhos (`ano_atual`: texto simples)                                                                                             |
| `{{pedido_minimo}}`, `{{regiao}}`, `{{pagamento}}`                             | Dados operacionais                                                                                                                                                              |
| `{{medicao_nome}}`, `{{sem_medicao}}`                                          | Para a política de privacidade: a ferramenta de medição, ou "não há"                                                                                                            |
| `{{tem_fatos}}`, `{{tem_diferenciais}}`, `{{tem_provas}}`, `{{tem_confianca}}` | "sim" ou vazio, para usar em `{{#se ...}}`: há pedido mínimo ou região; há diferenciais; há cliente, depoimento ou nota para mostrar; a faixa de confiança tem ao menos um item |

### O que NÃO mexer (sem falar com quem programa)

- `index.html` e `politica-de-privacidade.html`: são o **layout** (estrutura, CSS e a animação). Só têm `{{arquivo.campo}}` no lugar de cada texto.
- `src/`, `build/`, `site.config.js`, `vite.config.js`, `scripts/`, `tests/`: o código.
- `content/schemas/`: as regras do que é válido (limites de tamanho, listas de valores). Se um limite atrapalha, peça para mudar e conferir o layout.
- `content/exemplo/empresa.yaml`: os dados fictícios de referência.
- `public/brand/`, `public/produtos/`, `src/brand/marks.js`: arte da marca e dos produtos, geradas.
- `tests/fixtures/3d-lock.json`: trava da animação 3D.

**O que fica no código, de propósito (rótulos de interface, não são texto de negócio):** o link "Pular para o conteúdo", "ROLE ↓" da abertura, "Fechar" na folha do WhatsApp, os controles do carrossel (Pausar, Retomar, Anterior, Próximo, o rótulo "Exemplo"), os `aria-label` dos menus e das regiões da página (para leitor de tela), os textos do assistente de orçamento (experimento desligado) e as mensagens de "número copiado". Se um dia precisarem mudar, é com quem programa.

---

## Medição (Umami Cloud, sem cookies)

Todo evento vai para o `dataLayer`. Com `VITE_ANALYTICS_PROVIDER=umami` e `VITE_DATA_MODE=production` (em demo a medição fica desligada: o site de demonstração não soma visitas), os de negócio também vão ao Umami Cloud pelo nosso próprio JS (nenhum script de terceiro), só na página publicada: o host da `VITE_SITE_URL`, então dev, preview e testes nunca sujam a medição, e um navegador controlado por automação (`navigator.webdriver`: Lighthouse, Playwright, Selenium) não envia nada, para as execuções de teste no site publicado não gastarem a cota do plano grátis (o `dataLayer` segue completo). Para caber nos 100 mil eventos por mês do plano grátis, o Umami recebe só a visualização da página (enviada depois do carregamento, com o navegador ocioso, para não disputar a largada com a cena 3D; se a pessoa sai antes ou clica antes, ela vai primeiro), `whatsapp_click`, `handoff_fail` (o WhatsApp não abriu depois do clique), `whatsapp_copy` (copiou o número na folha de ajuda), `phone_click`, `map_click`, `cta_view` e um `visit_summary` por visita (capítulo e rolagem máximos, tour, `scene` (ms até a cena aparecer, que o LCP não mede; 0 = sem 3D), LCP, INP e CLS). Dentro do navegador do Instagram, Facebook ou TikTok todo evento leva `inapp` (`ig`, `fb` ou `tt`).

Eventos do `dataLayer`: `whatsapp_click{cta}`, `handoff_fail{cta}`, `whatsapp_copy{ok}`, `scene_ready{ms}`, `phone_click` e `map_click` (`{cta}` é o lugar do link), `cta_view`, `chapter_view`, `scroll_depth`, `section_view{section_id}`, `web_vitals{name,value}`, `first_interaction` e os do tour. Sem cookies, sem storage e sem banner; a [política de privacidade](politica-de-privacidade.html) explica. Criação da conta: [`docs/go-live.md`](docs/go-live.md).

**Cliques × conversas.** Cada botão põe o código de origem no fim da mensagem (`[site-hero]`, `[site-produtos-chapas]`…), e dentro do Instagram, Facebook ou TikTok o código ganha o sufixo do app (`[site-hero-ig]`). Para saber quantos cliques viraram conversa, conte as conversas com cada código no período e divida pelos `whatsapp_click` daquele `cta` (e `inapp`) no Umami. O `handoff_fail` mostra onde o WhatsApp não abriu. Limite conhecido: no navegador do Instagram ou do Facebook o wa.me às vezes abre dentro do próprio app; a página sai de vista e isso não conta como falha, então quem mede esse caso é o sufixo `-ig`/`-fb` nas conversas.

---

## Publicação contínua (GitHub Pages)

A verificação (lint, tipos e a suíte inteira de testes) mora em [`verificar.yml`](.github/workflows/verificar.yml), um workflow reutilizável chamado pelos dois fluxos abaixo; os testes rodam em 3 partes paralelas, cada uma num runner (`npm run test:parte`, repartidas pelo tempo em `scripts/test-parte.mjs`), e o job `verificar` no fim, o que a proteção da `master` exige, só passa se a qualidade e as 3 partes passarem; o Node vem do `.nvmrc` e as actions são fixadas por SHA (o [Dependabot](.github/dependabot.yml) propõe as atualizações, uma por assunto, toda segunda-feira).

- **Pull request** ([`ci.yml`](.github/workflows/ci.yml)): `verificar`, `paridade` e `lighthouse` (este é informativo e não bloqueia o merge: mostra no resumo do run o Lighthouse, com os tetos de `scripts/audit/lighthouse.mjs`, e os bytes do build). A paridade compara, pixel a pixel, o PR com a branch de destino em 6 tamanhos de tela e compara a estrutura do HTML (`npm run audit:paridade`). Uma diferença de pixel só reprova se se repetir nos mesmos pixels numa segunda captura: o renderizador do CI às vezes erra um ou dois pixels de borda, em pontos diferentes a cada execução, e uma mudança real é determinística. O rótulo `muda-visual` no PR deixa a diferença de pixels passar (as imagens ficam num artefato do CI); `muda-html` deixa passar só a diferença no HTML, que vira aviso.
- **Push na `master`** ([`deploy.yml`](.github/workflows/deploy.yml)): roda `verificar` de novo e só publica se passar.
- **Proteção da `master`** (GitHub, Settings › Branches): os checks `verificar / verificar` e `paridade` são obrigatórios no merge; ninguém, além de quem administra o repositório, empurra direto na `master`, e force-push e exclusão da branch são recusados.

> [!IMPORTANT]
> Em **Settings → Pages**, selecione **Source: GitHub Actions**. Isso impede que o builder legado (Jekyll) publique o código-fonte cru.

---

## Arquitetura

```text
404.html                   Página 404 (passa pelo build: CSP, link para o início da URL do site e textos de content/site.yaml)
index.html                 Página única: CSS inline (tokens da marca), HTML e metadados
site.config.js             Marca, variáveis dos textos e createSiteConfig({ env, content }): monta a config
content/                   Dados da empresa e textos editáveis (YAML + JSON Schema em content/schemas/)
build/content.js           Lê e valida content/ (erros em português, com arquivo, linha e campo)
build/texto.js             Linguagem dos textos: {{variável}} e {{#se}}...{{/se}}
build/privacidade.js       Markdown mínimo da política de privacidade (content/privacidade.md)
build/three-compartilhado.js  O three.js num arquivo só (assets/three-*.js) para os workers e o render de reserva
build/render.js            Escreve os dados no HTML (WhatsApp, rodapé, {{variáveis}}, diferenciais, clientes, JSON-LD)
build/validate.js          Trava de go-live: demo × production
build/files.js             robots.txt e sitemap.xml gerados da URL do site
build/env.js               Leitor de .env fora do Vite (os testes comparam o .env com o .env.example)
vite.config.js             Plugins: dados no HTML, robots/sitemap e CSP por hash dos <style>
src/years.js               Anos de mercado e ano do © (build e navegador)
src/main.js                Orquestra: história ↔ cena, tour automático, medição de uso
src/story.js               scroll → progresso (0…1), cartão ativo, cabeçalho, dica e botão flutuante
src/tour.js                Tour automático: rola a página pelos 5 capítulos e para no fim da história
src/analytics.js           Medição: dataLayer + Umami Cloud (sem cookies, só na página publicada)
src/vitals.js              Core Web Vitals reais (web-vitals, carregado com o navegador ocioso)
src/experiments.js         Experimentos A/B (variante por visita no sessionStorage, ?exp_<nome>=B força)
src/wizard.js              Assistente de orçamento da variante B do experimento quote_wizard
src/handoff.js             "O WhatsApp não abriu?": folha de ajuda e navegador embutido (Instagram, Facebook, TikTok)
src/carrossel.js           Carrossel de clientes: esteira na Web Animations API, pausa, setas, teclado e arrasto
src/produtos/              3D de cada produto: gatilho (JS inicial), montagem na página, worker com um WebGL só e os 3 modelos
build/csp.js               CSP por hash dos <style> (e o servidor da medição, se houver)
politica-de-privacidade.html  2ª página: política de privacidade com os dados de content/
src/render/stage.js        Liga o canvas ao render: Web Worker (OffscreenCanvas) ou thread principal
src/render/worker.js       Ponto de entrada do worker
src/render/controller.js   Loop de render sob demanda, suavização, qualidade adaptativa, contexto perdido
src/scene/                 Cena 3D procedural: factory/truck/hero/timeline/camera/geometry/textures
src/brand/marks.js         Caminhos da marca em curvas (gerado por `node scripts/brand.mjs`, que roda scripts/brand.py com uv)
public/brand/              SVGs oficiais da marca (Floresta, Carvão, Papel e negativos)
public/fonts/              Archivo (WOFF2, pesos 400 a 900)
scripts/audit/             Auditorias: bundle, cena, runtime, Lighthouse, capturas e paridade visual
jsconfig*.json, src/types.d.ts  Checagem de tipos por JSDoc (npm run typecheck)
tests/                     Testes de navegador (Playwright) e da cena (node:test)
docs/                      Manual da marca, notas da v4, 3D dos produtos, experimentos A/B, go-live e provas/ (autorizações)
```

### Como a história funciona

- A cena 3D é uma função de `p` (0…1): o scroll da seção `.story` (560 svh no desktop e 400 svh no celular, com o palco fixo na tela) vira `p`, e o render só desenha quando `p` muda.
- O render roda num **Web Worker** com `OffscreenCanvas`, então a thread principal fica livre. Sem suporte (ou se o worker falhar), a mesma cena roda na thread principal; sem WebGL, ficam o fundo Papel, o símbolo e os cartões, que continuam legíveis e navegáveis.
- O **tour automático** começa no instante em que a cena fica pronta, sem espera e em qualquer tela (no topo, sem `#hash`, sem `?tour=0`, sem movimento reduzido no sistema; `?tour=1` força o tour mesmo com movimento reduzido, para testar): a página rola sozinha pelos capítulos em ~18 s, **a cena segue o scroll** e o tour para no fim da história (não segue para as seções seguintes), quando o botão "Pedir orçamento" do cabeçalho pulsa. No F5 a página volta ao topo e o tour toca de novo. Qualquer roda, toque, clique, tecla ou scroll interrompe, e ele nunca retoma sozinho. Quando o tour não começa, o console diz o motivo (`[vanpack] autoplay não iniciou: …`).
- A qualidade se adapta ao aparelho: densidade limitada (2× no desktop, 1,5× no celular e 4,5 MP), sombra em tempo real só no desktop, e, se os quadros passam de ~24 ms, a resolução cai e depois a sombra para (sem recompilar shaders).

---

## Testes

`npm test` gera o build de produção e o de auditoria e roda, em sequência:

- `tests/conversion.test.mjs`: nenhum botão do WhatsApp sem número, código de origem `[site-…]` na mensagem, mensagem curta (sem lacunas) e campanha (`utm_*`) no texto, sem cookie nem storage.
- `tests/handoff.test.mjs`: folha "O WhatsApp não abriu?" (sobe em 2,5 s com a página à vista, não sobe se o app abre, fecha sozinha se ele abre depois, Esc, "Fechar", Ctrl+clique e copiar número) e navegador embutido (user agent, código `[site-hero-ig]` e a instrução). Usa o relógio falso do Playwright.
- `tests/trust.test.mjs`: faixa de confiança (com a regra do pagamento) e anos de mercado/© recalculados no navegador (relógio em 2031).
- `tests/analytics.test.mjs`: eventos no Umami (interceptado, nenhum tráfego real), resumo da visita, sem cookie nem storage, nada enviado fora do host do site e nada enviado por navegador automatizado (`navigator.webdriver`), com o `dataLayer` completo.
- `tests/site-config.test.mjs`: config, trava de go-live (demo × production), render com a config vazia, os 5 cartões com qualquer config, produtos, diferenciais e clientes de `content/`, logos e registros de autorização, JSON-LD, robots e sitemap; puro, sem navegador.
- `tests/conteudo.test.mjs`: nada de e-mail, prazo, promessa de tempo de resposta, texto de processo industrial ou travessão no que a página mostra ou faz um leitor de tela ler (texto, aria-label, alt, title, metas, JSON-LD e mensagens do WhatsApp), em demo, em production e no build publicado; puro.
- `tests/trava-3d.test.mjs`: o 3D principal é intocável: compara o sha256 de `src/scene/`, `src/render/` e `tests/scene.test.mjs` com `tests/fixtures/3d-lock.json`.
- `tests/data-source.test.mjs`: nenhum dado de `content/empresa.yaml` escrito à mão no código, o conteúdo chega à página publicada, todo número visível vem de `content/` e o `.env` guarda só o que muda por ambiente.
- `tests/template.test.mjs`: prova que nenhum texto de negócio ficou escrito à mão no `index.html`, na política ou no `build/render.js` (todo texto de `content/` vira um marcador, a página é renderizada e, tirados os marcadores, os dados da empresa e os rótulos de interface, não sobra letra).
- `tests/privacidade.test.mjs`: o Markdown da política (título, resumo, seções, links, trechos condicionais, as duas versões da seção de medição e os erros de build).
- `tests/content.test.mjs` e `tests/texto.test.mjs`: o carregador de `content/` (YAML mal formado, campo que falta ou não existe, tipo errado, tamanho, lista, valor fora da lista, travessão, variável inexistente: cada um vira mensagem em português com arquivo, linha e campo) e a linguagem dos textos.
- `tests/site-url.test.mjs`: build em production com domínio próprio: canonical, Open Graph, JSON-LD, robots, sitemap e medição derivam todos da `VITE_SITE_URL`.
- `tests/experiments.test.mjs` e `tests/wizard.test.mjs`: sorteio, persistência, data de término e variante forçada; o assistente de 3 passos (mensagem, validação, teclado, rótulos, contraste e celular).
- `tests/tour.test.mjs`: início automático, percurso e parada no fim da história, interrupções (roda, tecla, clique, toque, scroll, aba oculta e o link "Ver produtos ↓"), `?tour=0`, `#hash`, movimento reduzido e, no celular, o pulso da barra no fim. Usa o relógio falso do Playwright.
- `tests/carrossel.test.mjs`: carrossel de clientes em 1440×900 e 390×844: anda sozinho para a esquerda, pausa com o mouse, com foco de teclado, ao tocar e pelo botão (que só volta pelo botão), setas, teclado e arrasto movem, movimento reduzido sem movimento automático, poucos clientes parados e centralizados sem cópias nem controles, cópias com `aria-hidden` e `inert`, sem sobreposição, sem rolagem horizontal e alvos de 44 px.
- `tests/produtos.test.mjs`: 3D de cada produto: nenhum chunk antes de a seção chegar perto, monta ao rolar e não fica em branco, gira, só desenha o que está à vista, longe libera tudo e o worker sai, movimento reduzido parado, no máximo 1 contexto WebGL além do da história, sem vazamento ao rolar para dentro e para fora, contexto perdido e restaurado, ilustração em SVG sem WebGL, com economia de dados, rede 3g ou 2 GB de memória (sem salto de layout), e os 3 botões de orçamento funcionando.
- `tests/layout.test.mjs`: cartão × cabeçalho × botão flutuante × dica sem sobreposição em 1440×900, 1366×768, 924×540, 720×450, 360×640, 390×844 e 844×390, nos 5 capítulos; alvos de toque ≥ 44 px; no celular, a barra do 2º capítulo em diante e a 1ª tela com título, pedido mínimo, botão e linha de risco sem rolar; produtos em 3 colunas no desktop e 1 no celular, com a área 4:3 do 3D no topo de cada cartão, sem salto de layout ao carregar.
- `tests/a11y.test.mjs`: estrutura, ordem e visibilidade do foco, cartões `inert`, movimento reduzido e contraste calculado nos estilos reais.
- `tests/robustness.test.mjs`: sem WebGL, worker bloqueado (fallback na thread principal) e contexto WebGL perdido e restaurado.
- `tests/brand.test.mjs`: paleta, tipografia, efeitos proibidos, ausência de raster/rota/pinos/formulário, SVGs da marca, CSP e requisições.
- `tests/scene.test.mjs`: linha do tempo, câmera, estrada, geometria e piso.
- `tests/limites.test.mjs`: o pior caso que o build aceita: todo texto de `content/` no tamanho máximo do schema e as listas cheias (6 diferenciais, 12 clientes); o site é construído assim (`dist-limite/`) e passa no `tests/layout.test.mjs` em todos os tamanhos de tela.
- `tests/foco.test.mjs`: percorre a página com Tab e falha se um foco ficar atrás do botão fixo do WhatsApp (WCAG 2.4.11).
- `tests/axe.test.mjs`: axe-core com as regras WCAG 2.0 a 2.2 A e AA na página principal e na política: sem violação.
- `tests/html.test.mjs`: html-validate (`.htmlvalidate.json`) nas páginas publicadas, com as exceções justificadas.
- `tests/docs.test.mjs`: sem travessão longo em README, guias, `docs/`, `content/` e workflows; README com toda variável dos textos e todo comando de auditoria.
- `tests/orcamento.test.mjs`: tetos de bytes do `dist/` (gzip por arquivo, JS inicial, carga inicial e visita completa); os tetos só descem (hoje: JS inicial 139,1 KB, carga inicial 178,6 KB, visita completa 188,2 KB).
- `tests/three-compartilhado.test.mjs`: o three.js é um arquivo só (`assets/three-*.js`), importado pelos dois workers e pelo render de reserva, que não levam cópia; os imports do `src/` só por nome. O aparo dos shaders (só os dos materiais que a cena usa; versão do three.js e material fora da tabela derrubam o build) e o `<link rel="modulepreload">` do three.js no `index.html` também são conferidos aqui.
- `tests/erro-de-build.test.mjs`: conteúdo errado derruba o `vite build` só com a mensagem (arquivo, linha, campo), sem rastro de pilha do Node e sem erro falso em cascata.
- `tests/subcaminho.test.mjs`: o `dist/` servido em `/vanpack-pages/`, como no GitHub Pages, por um servidor que devolve 404 de verdade: nenhum pedido pode falhar (um endereço que virasse absoluto reprovaria).
- `tests/servidor-lento.test.mjs`: o servidor de laboratório do `audit:carga` (latência, banda compartilhada, gzip, 404).
- `tests/partes.test.mjs`: cada arquivo de teste roda em exatamente uma das partes paralelas do CI, e as partes ficam equilibradas.
- `tests/typecheck.test.mjs`: o filtro do `npm run typecheck` só deixa de fora os erros de tipo de `src/scene/` e `src/render/` (travados por hash); o resto, inclusive `src/main.js`, continua reprovando.
- `tests/hooks.test.mjs`: o hook de pre-push opcional recusa o push quando o lint ou os tipos falham.

---

## Marca, produto e segurança

- Cores: só Floresta, Carvão, Papel e Kraft (o Kraft é o material, nunca texto ou botão); só Archivo; logotipo sempre em curvas, em negativo sobre Floresta, com respiro de ¼ do símbolo.
- Sem imagem raster (nenhuma foto: só SVG; logos de clientes também só em SVG), sem formulário, sem números ou alegações inventados. Logo de cliente (de `content/clientes.yaml`, com `autorizado: true`), depoimento e nota do Google só com autorização registrada em [`docs/provas/`](docs/provas/README.md); em demo, os clientes de exemplo levam o rótulo "Exemplo".
- Sem PWA: sem manifest, sem service worker e sem instalação como app (decisão do dono: é uma landing de um só objetivo). Ficam `theme-color`, os favicons, o `apple-touch-icon` e o `icon-512.png`, que o JSON-LD usa como logo.
- CSP por `<meta>` com hash de cada `<style>` (`script-src 'self'`, sem CDN, sem `eval`); o único domínio externo é o servidor da medição (Umami), e só com provedor configurado; links externos com `rel="noopener"`.
