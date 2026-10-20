# Registro de provas sociais

Nada de logo de cliente, depoimento ou nota do Google entra no site sem autorização de quem é citado.
Cada item publicado precisa de um arquivo `docs/provas/<id>.md`; um teste confere.

- **Clientes (faixa de logos):** vêm do `.env`, em `VITE_CLIENT_<n>_NAME`, `VITE_CLIENT_<n>_LOGO` e
  `VITE_CLIENT_<n>_AUTH` (até 12). Em `production` só aparece o cliente com `AUTH=sim`. O `<id>` é o
  nome em minúsculas, sem acento e com hífens: `VITE_CLIENT_1_NAME="Padaria Real"` →
  `docs/provas/padaria-real.md`.
- **Depoimentos e nota do Google:** ficam em `site.config.js` (constante `proofs`), com
  `authorized: true` e um `id`; o arquivo é `docs/provas/<id>.md` (a nota do Google usa `google`).

Em modo demo, os clientes "Cliente 1" a "Cliente 6" do `.env` são exemplos: aparecem com o rótulo
"Exemplo", sem logo, e o build de `production` recusa se eles sobrarem. Troque-os pelos reais (ou
apague as linhas) antes do go-live.

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
- Autorizado: "Caixa sempre do mesmo tamanho e com a nossa marca bem impressa." (Fulana, Empresa A)
- Onde pode aparecer: no site da Vanpack.
```

## Logos e nota do Google

- Logos de clientes só em SVG, em `public/clientes/` (o site não aceita imagem raster); o
  `VITE_CLIENT_<n>_LOGO` leva só o nome do arquivo, ex.: `padaria-real.svg`. Sem logo, a faixa mostra o
  nome em texto.
- A nota do Google (`googleRating`) só entra se for a nota real do Perfil da Empresa, com `authorized:
true`; o JSON-LD nunca leva `aggregateRating` próprio.
