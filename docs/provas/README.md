# Registro de provas sociais

Nada de depoimento, logo de cliente ou nota do Google entra no site sem autorização de quem é citado.
Cada item publicado (com `authorized: true` em `site.config.js`, na constante `proofs`) precisa de um
arquivo `docs/provas/<id>.md`, em que `<id>` é o mesmo `id` do item. Um teste confere.

Os itens com `demo: true` são exemplos: só aparecem com `VITE_DATA_MODE=demo`, com o rótulo "Exemplo", e
nunca em `production`. Troque-os pelos reais antes do go-live.

## O que o arquivo registra

- **Quem autorizou**: nome, cargo e empresa.
- **Quando e por onde**: data e canal (e-mail, WhatsApp) da autorização, de preferência com o print.
- **O que foi autorizado**: o texto exato do depoimento, ou o logo (SVG), ou o link da avaliação.
- **Onde pode aparecer**: no site da Vanpack; se houver limite (só por um período, por exemplo), diga aqui.

## Exemplo

```md
# cliente-a

- Quem autorizou: Fulana de Tal, compras, Empresa A LTDA.
- Quando e por onde: 02/11/2026, por WhatsApp (print em arquivo à parte).
- Autorizado: "Entrega no prazo e caixa sempre do mesmo tamanho." (Fulana, Empresa A)
- Onde pode aparecer: no site da Vanpack.
```

## Logos e nota do Google

- Logos de clientes só em SVG, em `public/clientes/<id>.svg` (o site não aceita imagem raster).
- A nota do Google (`googleRating`) só entra se for a nota real do Perfil da Empresa, com `authorized:
true`; o JSON-LD nunca leva `aggregateRating` próprio.
