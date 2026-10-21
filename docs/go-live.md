# Go-live: dos dados fictícios para os dados reais

Hoje o site roda com **dados fictícios** (`VITE_DATA_MODE=demo` no `.env`): CNPJ, telefone, WhatsApp,
endereço, pedido mínimo e clientes de exemplo inventados, o HTML sai com `noindex` e o `robots.txt`
bloqueia tudo, para o Google não indexar um CNPJ falso. Os dados da empresa e os textos do site vivem na
pasta `content/` (o `.env` guarda só o que muda por ambiente). Para ir ao ar com dados reais, **edite só
`content/` e o `.env`**; nenhum telefone, CNPJ, endereço, diferencial ou cliente está escrito à mão no
HTML, no JSON-LD, no `robots.txt` nem no `sitemap.xml`. O passo a passo de edição, com exemplos, está no
README ("Como editar o conteúdo").

## Passo a passo

1. Troque os valores de `content/empresa.yaml` pelos reais (tabela abaixo). Campo vazio é aceito nos
   opcionais: o trecho correspondente simplesmente some da página, nada é inventado. Ponha sempre os
   textos entre aspas.
2. Troque os clientes de exemplo de `content/clientes.yaml` por clientes autorizados (ou apague as linhas)
   e confira os produtos e os diferenciais.
3. Troque `VITE_DATA_MODE` de `demo` para `production` no `.env`.
4. Rode `npm run build`. Em `production` o build **falha** e lista o que ainda não está pronto, com o
   arquivo, a linha e o campo: dado obrigatório vazio, formato inválido (CNPJ com dígito verificador
   errado, telefone sem `+55`, URL sem `https`), qualquer valor que ainda seja o fictício de
   `content/exemplo/empresa.yaml` e os clientes de exemplo que sobraram.
5. Confira a página com `npm run preview`: rodapé, faixa de confiança, botões do WhatsApp, diferenciais
   e clientes.
6. Abra um pull request e, com o CI verde, faça o merge na `master`. Os valores de `content/` e do
   `.env` são públicos (vão para o HTML); nunca coloque segredo neles.

Em `production` o `noindex` sai, o `robots.txt` volta a liberar o site e o `sitemap.xml` passa a ser
anunciado. Depois do deploy, peça a indexação no Search Console.

## Campos de `content/empresa.yaml`

| Campo               | O que é                                                    | Obrigatório | Como conferir                                       |
| ------------------- | ---------------------------------------------------------- | ----------- | --------------------------------------------------- |
| `whatsapp`          | 55 + DDD + número, só dígitos                              | sim         | Teste um botão do site                              |
| `telefone`          | Telefone em `+55DDDnúmero`                                 | production  | Igual ao do Perfil da Empresa no Google             |
| `telefone_exibicao` | Telefone como aparece na página                            | não         | Sem ele, a página formata o `telefone`              |
| `cnpj`              | CNPJ                                                       | production  | Cartão CNPJ da Receita (o build confere os dígitos) |
| `razao_social`      | Razão social                                               | não         | Cartão CNPJ                                         |
| `endereco.rua`      | Rua e número da fábrica                                    | production  | Igual ao Perfil da Empresa no Google                |
| `endereco.bairro`   | Bairro                                                     | não         | Cartão CNPJ                                         |
| `endereco.cidade`   | Cidade                                                     | production  | Cartão CNPJ                                         |
| `endereco.uf`       | UF, duas letras maiúsculas                                 | production  | Cartão CNPJ                                         |
| `endereco.cep`      | CEP, `00000-000`                                           | production  | Correios                                            |
| `horario`           | Horário de atendimento, como aparece no rodapé             | production  | Igual ao Perfil da Empresa no Google                |
| `horario_schema`    | Horário no formato do schema.org, ex.: `Mo-Fr 08:00-17:00` | não         | Vai só para o JSON-LD                               |
| `mapa`              | Link do Google Maps para o endereço (`https://`)           | não         | Abra o link                                         |
| `ano_fundacao`      | Ano de fundação                                            | não         | Confirme o ano: o "N anos de mercado" sai dele      |
| `pedido_minimo`     | Pedido mínimo, em unidades                                 | não         | Confirme com a produção                             |
| `regiao`            | Região atendida                                            | não         | Confirme com o comercial                            |
| `pagamento`         | Formas de pagamento                                        | não         | Confirme com o financeiro                           |

Os outros arquivos de `content/` (os textos da página: `site.yaml`, `historia.yaml`, `confianca.yaml`, `orcamento.yaml`, `whatsapp.yaml` e `rodape.yaml`, além destes):

- `produtos.yaml`: os 3 produtos (nome, descrição, mensagem do botão e descrição do 3D para leitor de tela).
- `diferenciais.yaml`: até 6 cartões de "Por que a Vanpack" (título, texto e ícone: `fabrica`, `lotes`,
  `conversa` ou `caixa`). Sem nenhum, a seção some.
- `clientes.yaml` e `clientes/`: até 12 clientes da faixa de logos, com o logo em SVG. Os 6 "Cliente N"
  são exemplos (`exemplo: true`): o build de production recusa enquanto sobrar algum. `autorizado: true`
  exige o registro em `docs/provas/<id>.md`.
- `provas.yaml`: depoimentos e nota do Google, só com autorização registrada.
- `exemplo/empresa.yaml`: os valores fictícios de referência. Não edite: o build compara com ele para
  reconhecer, em production, um dado que ainda é de demonstração (cidade, UF e ano de fundação ficam de
  fora: já são reais).

## Chaves do `.env`

| Chave                     | O que é                                          | Obrigatória | Como conferir                         |
| ------------------------- | ------------------------------------------------ | ----------- | ------------------------------------- |
| `VITE_DATA_MODE`          | `demo` (fictícios, noindex) ou `production`      | sim         | Troque para `production` no go-live   |
| `VITE_SITE_URL`           | Endereço público do site, terminando em `/`      | sim         | `https` em production; canonical e OG |
| `VITE_ANALYTICS_PROVIDER` | `umami` ou vazio (sem medição)                   | não         | Medição sem cookies, sem pop-up       |
| `VITE_ANALYTICS_SITE`     | Website ID do site no Umami Cloud                | com umami   | Painel do Umami, em Settings do site  |
| `VITE_ANALYTICS_ENDPOINT` | Servidor do Umami, só se tiver instância própria | não         | Deixe vazio para usar o Umami Cloud   |

Pedido mínimo, região, formas de pagamento e diferenciais também são promessas: confirme cada um com a
área responsável antes de publicar.

## Conteúdo para conferir

Estes textos estão em `content/` e foram escritos como rascunho: confira cada um com quem sabe.

- **Produtos** (3 cartões em "O que fabricamos", `content/produtos.yaml`): nomes, descrições, a mensagem de cada botão e a descrição de cada 3D para leitor de tela (`peca`).
- **Textos dos 5 cartões da história** (`content/historia.yaml`) e **diferenciais** (`content/diferenciais.yaml`): são rascunho e podem mudar depois da pesquisa de posicionamento. Nenhum pode falar de prazo, de tempo de resposta ou do processo de fabricação (o `tests/conteudo.test.mjs` confere).
- **Faixa de confiança**: "Nunca pedimos pagamento para conta de pessoa física" é promessa; confirme com o financeiro.
- **Clientes**: os 6 "Cliente N" são exemplos. Para publicar um cliente, ponha o nome, o logo em SVG (em `content/clientes/`) e `autorizado: true` em `content/clientes.yaml`, com a autorização registrada; siga [`docs/provas/README.md`](provas/README.md). Depoimentos (`content/provas.yaml`) também só com autorização.
- **Fotos**: o site não usa nenhuma foto (decisão do dono). Se um dia quiser, a única permitida é a da fachada.

## Domínio próprio

O site é publicado pelo GitHub Actions, então o arquivo `CNAME` é ignorado: o domínio vai nas configurações do repositório.

1. Em **Settings → Pages → Custom domain**, informe o domínio e marque **Enforce HTTPS** quando o certificado ficar pronto.
2. No provedor do domínio, crie os registros DNS que o GitHub indicar.
3. Troque `VITE_SITE_URL` no `.env` para a URL nova (`https`, terminando em `/`). Canonical, Open Graph, JSON-LD, `robots.txt`, `sitemap.xml` e a medição passam a usar o domínio novo sozinhos; um teste confere que nada da URL antiga sobra.
4. No Umami, troque o domínio do site (ou crie outro e atualize `VITE_ANALYTICS_SITE`).
5. No Search Console, verifique o domínio e envie o `sitemap.xml`; no Perfil da Empresa no Google, aponte o site para a URL nova.

## Medição (Umami Cloud)

A medição é sem cookies, então o site não precisa de banner. Para ligá-la:

1. Crie a conta em cloud.umami.is (e-mail e senha; o plano Hobby é grátis: 100 mil eventos por mês, 1 site e 6 meses de histórico).
2. Cadastre o site. O campo **Domain** aceita só o host, sem `https://` e sem caminho (hoje `marcelo-franceschini.github.io`; no go-live, o domínio próprio).
3. Copie o **Website ID** (Settings do site) para `VITE_ANALYTICS_SITE` e deixe `VITE_ANALYTICS_PROVIDER=umami`.
4. **Não** cole o "Tracking code" do Umami no HTML: o nosso JS já chama a API deles, e a CSP bloquearia o script.

O site só envia eventos quando o host da página é o da `VITE_SITE_URL`: ao trocar de domínio, mude a URL no `.env` e o domínio do site no Umami. Os dados passam por servidores dos EUA e da UE; a [política de privacidade](../politica-de-privacidade.html) do site explica isso e cita o plano atual (se mudar de plano, ajuste o texto de retenção nela). Vale uma checagem rápida dessa política com o jurídico antes do go-live.

## Checklist final

- [ ] `VITE_DATA_MODE=production` e `npm run build` passam (o build recusa valor fictício e cliente de exemplo).
- [ ] Endereço, telefone e horário idênticos ao Perfil da Empresa no Google.
- [ ] Nenhum `href` de WhatsApp começa com `https://wa.me/?` (o build também recusa).
- [ ] `<meta name="robots" content="noindex,nofollow">` não existe mais no HTML publicado.
- [ ] `robots.txt` libera o site e o `sitemap.xml` tem a URL final.
- [ ] A política de privacidade foi revisada pelo jurídico.
- [ ] Produtos, textos dos cartões e diferenciais conferidos; clientes de exemplo trocados por clientes autorizados (ou apagados).
- [ ] O assistente (chatbot) do WhatsApp já está no ar: o passo 2 de "Como pedir" diz que ele pergunta medida, quantidade e impressão, e o CTA final convida a mandar a foto do produto. A página não promete tempo de resposta.
- [ ] Depois do deploy, abra o link de dentro do Instagram (e do Facebook) num celular: o botão abre o WhatsApp? Se não abrir, a folha "O WhatsApp não abriu?" aparece?
- [ ] `npm run og` gera de novo `public/og.jpg`: a imagem atual ainda mostra o texto antigo do hero ("A gente fabrica, imprime e entrega") e precisa ser refeita antes do go-live.
- [ ] `npm run audit:lighthouse`: SEO 100 só é possível em `production` (em demo o `noindex` reprova o
      item "página bloqueada para indexação", como esperado).
- [ ] `npm run lint` e `npm test` passam.
