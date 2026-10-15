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

| Chave                     | O que é                                                    | Obrigatória | Como conferir                                       |
| ------------------------- | ---------------------------------------------------------- | ----------- | --------------------------------------------------- |
| `VITE_DATA_MODE`          | `demo` (fictícios, noindex) ou `production`                | sim         | Troque para `production` no go-live                 |
| `VITE_SITE_URL`           | Endereço público do site, terminando em `/`                | sim         | `https` em production; vale para canonical e OG     |
| `VITE_WHATSAPP`           | 55 + DDD + número, só dígitos                              | sim         | Teste um botão do site                              |
| `VITE_PHONE`              | Telefone em `+55DDDnúmero`                                 | production  | Igual ao do Perfil da Empresa no Google             |
| `VITE_PHONE_DISPLAY`      | Telefone como aparece na página                            | não         | Sem ele, a página formata o `VITE_PHONE`            |
| `VITE_EMAIL`              | E-mail de contato (de preferência do domínio da empresa)   | production  | Receba um e-mail de teste                           |
| `VITE_CNPJ`               | CNPJ                                                       | production  | Cartão CNPJ da Receita (o build confere os dígitos) |
| `VITE_LEGAL_NAME`         | Razão social                                               | não         | Cartão CNPJ                                         |
| `VITE_STREET`             | Rua e número da fábrica                                    | production  | Igual ao Perfil da Empresa no Google                |
| `VITE_DISTRICT`           | Bairro                                                     | não         | Cartão CNPJ                                         |
| `VITE_CITY`               | Cidade                                                     | production  | Cartão CNPJ                                         |
| `VITE_STATE`              | UF, duas letras                                            | production  | Cartão CNPJ                                         |
| `VITE_CEP`                | CEP, `00000-000`                                           | production  | Correios                                            |
| `VITE_HOURS`              | Horário de atendimento, como aparece no rodapé             | production  | Igual ao Perfil da Empresa no Google                |
| `VITE_HOURS_SCHEMA`       | Horário no formato do schema.org, ex.: `Mo-Fr 08:00-17:00` | não         | Vai só para o JSON-LD                               |
| `VITE_MAP_URL`            | Link do Google Maps para o endereço                        | não         | Abra o link                                         |
| `VITE_FOUNDED_YEAR`       | Ano de fundação                                            | não         | Confirme o ano: o "N anos de mercado" sai dele      |
| `VITE_MIN_ORDER`          | Pedido mínimo, em unidades                                 | não         | Confirme com a produção                             |
| `VITE_LEAD_TIME_DAYS`     | Prazo de entrega, em dias úteis                            | não         | Confirme com a produção                             |
| `VITE_SERVICE_AREA`       | Região atendida                                            | não         | Confirme com o comercial                            |
| `VITE_RESPONSE_TIME`      | Tempo de resposta do atendimento                           | não         | Só prometa o que o time cumpre                      |
| `VITE_PAYMENT_METHODS`    | Formas de pagamento                                        | não         | Confirme com o financeiro                           |
| `VITE_ANALYTICS_PROVIDER` | `umami` ou vazio (sem medição)                             | não         | Medição sem cookies, sem pop-up                     |
| `VITE_ANALYTICS_SITE`     | Website ID do site no Umami Cloud                          | com umami   | Painel do Umami, em Settings do site                |
| `VITE_ANALYTICS_ENDPOINT` | Servidor do Umami, só se tiver instância própria           | não         | Deixe vazio para usar o Umami Cloud                 |

As chaves "fictícias por natureza" (tudo, menos `VITE_DATA_MODE`, `VITE_SITE_URL`, `VITE_CITY`,
`VITE_STATE`, `VITE_FOUNDED_YEAR` e as de analytics) não podem sobrar com o valor do `.env.example`
em `production`. Pedido mínimo, prazo, região, tempo de resposta e formas de pagamento também são
promessas: confirme cada uma com a área responsável antes de publicar.

## Checklist final

- [ ] `VITE_DATA_MODE=production` e `npm run build` passam (o build recusa valor fictício).
- [ ] Endereço, telefone e horário idênticos ao Perfil da Empresa no Google.
- [ ] Nenhum `href` de WhatsApp começa com `https://wa.me/?` (o build também recusa).
- [ ] `<meta name="robots" content="noindex,nofollow">` não existe mais no HTML publicado.
- [ ] `robots.txt` libera o site e o `sitemap.xml` tem a URL final.
- [ ] `npm run og` gera de novo `public/og.jpg`: a imagem de compartilhamento tem o texto do hero.
- [ ] `npm run audit:lighthouse`: SEO 100 só é possível em `production` (em demo o `noindex` reprova o
      item "página bloqueada para indexação", como esperado).
- [ ] `npm run lint` e `npm test` passam.
