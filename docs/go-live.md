# Go-live: dos dados fictícios para os dados reais

Hoje o site roda com **dados fictícios** (`VITE_DATA_MODE=demo`): CNPJ, telefone, WhatsApp, endereço,
prazos e pedido mínimo inventados, o HTML sai com `noindex` e o `robots.txt` bloqueia tudo, para o
Google não indexar um CNPJ falso. Todo dado da empresa vive num único arquivo, o `.env`. Para ir ao ar
com dados reais, **edite só o `.env`**; nenhum telefone, CNPJ, endereço ou prazo está escrito à mão no
HTML, no JSON-LD, no FAQ, no `robots.txt` nem no `sitemap.xml`.

## Passo a passo

1. Troque os valores do `.env` pelos reais (tabela abaixo). Valor vazio é aceito nas chaves opcionais:
   o trecho correspondente simplesmente some da página, nada é inventado.
2. Troque `VITE_DATA_MODE` de `demo` para `production`.
3. Rode `npm run build`. Em `production` o build **falha** e lista o que ainda não está pronto: campo
   obrigatório vazio, formato inválido (CNPJ com dígito verificador errado, telefone sem `+55`, URL
   sem `https`) e qualquer valor que ainda seja o fictício do `.env.example`.
4. Confira a página com `npm run preview`: rodapé, faixa de confiança, botões do WhatsApp e FAQ.
5. Abra um pull request e, com o CI verde, faça o merge na `master`: o deploy lê o `.env` do repositório.
   Os valores do `.env` são públicos (vão para o HTML); nunca coloque segredo nele.

Em `production` o `noindex` sai, o `robots.txt` volta a liberar o site e o `sitemap.xml` passa a ser
anunciado. Depois do deploy, peça a indexação no Search Console.

## Chaves do `.env`

| Chave                     | O que é                                                       | Obrigatória   | Como conferir                                                        |
| ------------------------- | ------------------------------------------------------------- | ------------- | -------------------------------------------------------------------- |
| `VITE_DATA_MODE`          | `demo` (fictícios, noindex) ou `production`                   | sim           | Troque para `production` no go-live                                  |
| `VITE_SITE_URL`           | Endereço público do site, terminando em `/`                   | sim           | `https` em production; vale para canonical e OG                      |
| `VITE_WHATSAPP`           | 55 + DDD + número, só dígitos                                 | sim           | Teste um botão do site                                               |
| `VITE_PHONE`              | Telefone em `+55DDDnúmero`                                    | production    | Igual ao do Perfil da Empresa no Google                              |
| `VITE_PHONE_DISPLAY`      | Telefone como aparece na página                               | não           | Sem ele, a página formata o `VITE_PHONE`                             |
| `VITE_EMAIL`              | E-mail de contato (de preferência do domínio da empresa)      | production    | Receba um e-mail de teste                                            |
| `VITE_CNPJ`               | CNPJ                                                          | production    | Cartão CNPJ da Receita (o build confere os dígitos)                  |
| `VITE_LEGAL_NAME`         | Razão social                                                  | não           | Cartão CNPJ                                                          |
| `VITE_STREET`             | Rua e número da fábrica                                       | production    | Igual ao Perfil da Empresa no Google                                 |
| `VITE_DISTRICT`           | Bairro                                                        | não           | Cartão CNPJ                                                          |
| `VITE_CITY`               | Cidade                                                        | production    | Cartão CNPJ                                                          |
| `VITE_STATE`              | UF, duas letras                                               | production    | Cartão CNPJ                                                          |
| `VITE_CEP`                | CEP, `00000-000`                                              | production    | Correios                                                             |
| `VITE_HOURS`              | Horário de atendimento, como aparece no rodapé                | production    | Igual ao Perfil da Empresa no Google                                 |
| `VITE_HOURS_SCHEMA`       | Horário no formato do schema.org, ex.: `Mo-Fr 08:00-17:00`    | não           | Vai só para o JSON-LD                                                |
| `VITE_MAP_URL`            | Link do Google Maps para o endereço                           | não           | Abra o link                                                          |
| `VITE_FOUNDED_YEAR`       | Ano de fundação                                               | não           | Confirme o ano: o "N anos de mercado" sai dele                       |
| `VITE_MIN_ORDER`          | Pedido mínimo, em unidades                                    | não           | Confirme com a produção                                              |
| `VITE_LEAD_TIME_DAYS`     | Prazo de entrega, em dias úteis                               | não           | Confirme com a produção                                              |
| `VITE_SERVICE_AREA`       | Região atendida                                               | não           | Confirme com o comercial                                             |
| `VITE_PAYMENT_METHODS`    | Formas de pagamento                                           | não           | Confirme com o financeiro                                            |
| `VITE_WHATSAPP_HOURS`     | Horário do assistente (chatbot) do WhatsApp, ex.: `24 horas`  | não           | Só com o assistente no ar: vira "Resposta na hora"                   |
| `VITE_DIFF_<n>_TITLE`     | Título do diferencial `<n>` (de 1 a 6) em "Por que a Vanpack" | não           | Sem título, o diferencial some; sem nenhum, a seção some             |
| `VITE_DIFF_<n>_TEXT`      | Texto do diferencial                                          | não           | Sem promessa de prazo nem de tempo de resposta                       |
| `VITE_DIFF_<n>_ICON`      | Ícone: `fabrica`, `lotes`, `conversa` ou `caixa`              | não           | O build recusa outro nome                                            |
| `VITE_CLIENT_<n>_NAME`    | Nome do cliente `<n>` (de 1 a 12) na faixa de logos           | não           | "Cliente 1" a "Cliente 6" são exemplos: o build de production recusa |
| `VITE_CLIENT_<n>_LOGO`    | Arquivo SVG do logo, em `public/clientes/` (ex.: `loja.svg`)  | não           | Só SVG; vazio, aparece o nome em texto                               |
| `VITE_CLIENT_<n>_AUTH`    | `sim` quando o cliente autorizou a divulgação                 | para aparecer | Registro em `docs/provas/<id>.md` (veja lá)                          |
| `VITE_ANALYTICS_PROVIDER` | `umami` ou vazio (sem medição)                                | não           | Medição sem cookies, sem pop-up                                      |
| `VITE_ANALYTICS_SITE`     | Website ID do site no Umami Cloud                             | com umami     | Painel do Umami, em Settings do site                                 |
| `VITE_ANALYTICS_ENDPOINT` | Servidor do Umami, só se tiver instância própria              | não           | Deixe vazio para usar o Umami Cloud                                  |

As chaves "fictícias por natureza" (tudo, menos `VITE_DATA_MODE`, `VITE_SITE_URL`, `VITE_CITY`,
`VITE_STATE`, `VITE_FOUNDED_YEAR` e as de analytics) não podem sobrar com o valor do `.env.example`
em `production`. Pedido mínimo, prazo, região e formas de pagamento também são
promessas: confirme cada uma com a área responsável antes de publicar.

## Conteúdo para conferir

Estes textos estão em `site.config.js` e foram escritos como rascunho: confira cada um com quem sabe.

- **Modelos de caixa** (4 cartões em "O que fabricamos"): nomes e descrições.
- **FAQ**: "Nunca pedimos pagamento para conta de pessoa física", "Pode nos visitar", a diferença entre onda simples e dupla e como enviar a logo.
- **Prova social**: os dois depoimentos de exemplo só aparecem em modo demo (com o rótulo "Exemplo") e somem em `production`. Para publicar prova real, siga [`docs/provas/README.md`](provas/README.md): autorização registrada por item.
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

- [ ] `VITE_DATA_MODE=production` e `npm run build` passam (o build recusa valor fictício).
- [ ] Endereço, telefone e horário idênticos ao Perfil da Empresa no Google.
- [ ] Nenhum `href` de WhatsApp começa com `https://wa.me/?` (o build também recusa).
- [ ] `<meta name="robots" content="noindex,nofollow">` não existe mais no HTML publicado.
- [ ] `robots.txt` libera o site e o `sitemap.xml` tem a URL final.
- [ ] A política de privacidade foi revisada pelo jurídico.
- [ ] Modelos de caixa e respostas do FAQ conferidos; depoimentos de exemplo trocados por prova autorizada (ou removidos).
- [ ] O assistente (chatbot) do WhatsApp já responde na hora, 24 horas: a página promete isso na linha de risco, em "Como pedir" e no rodapé. Confira também se o FAQ e o CTA final batem com o que ele faz (foto do produto, logo, arte).
- [ ] Depois do deploy, abra o link de dentro do Instagram (e do Facebook) num celular: o botão abre o WhatsApp? Se não abrir, a folha "O WhatsApp não abriu?" aparece?
- [ ] `npm run og` gera de novo `public/og.jpg`: a imagem de compartilhamento tem o texto do hero.
- [ ] `npm run audit:lighthouse`: SEO 100 só é possível em `production` (em demo o `noindex` reprova o
      item "página bloqueada para indexação", como esperado).
- [ ] `npm run lint` e `npm test` passam.
