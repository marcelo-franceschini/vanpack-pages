# Registro de provas sociais

Nada de logo de cliente, depoimento ou nota do Google entra no site sem autorização de quem é citado.
Cada item publicado precisa de um arquivo `docs/provas/<id>.md`; um teste confere.

- **Clientes (faixa de logos):** vêm de `content/clientes.yaml` (`nome`, `logo` e `autorizado`, até 12).
  Em `production` só aparece o cliente com `autorizado: true`, e o build recusa se faltar o registro.
  O `<id>` é o nome em minúsculas, sem acento e com hífens: `nome: "Padaria Real"` →
  `docs/provas/padaria-real.md`.
- **Depoimentos e nota do Google:** ficam em `content/provas.yaml`, com `autorizado: true` e um `id`; o
  arquivo é `docs/provas/<id>.md` (a nota do Google usa `google`).

Em modo demo, o cliente de `content/clientes.yaml` que ainda não tem `autorizado: true` aparece com o
rótulo "Exemplo"; em `production` ele fica fora da página até existir o registro. Um cliente com
`exemplo: true` o build de `production` recusa.

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

- Logos de clientes só em SVG, em `content/clientes/` (o site não aceita imagem raster; até 20 KB, com
  `viewBox`, sem script nem imagem embutida); o campo `logo` de `content/clientes.yaml` leva só o nome do
  arquivo, ex.: `padaria-real.svg`. Sem logo, a faixa mostra o nome em texto. O build otimiza o SVG sem
  mudar o desenho.
- A nota do Google (`nota_google`) só entra se for a nota real do Perfil da Empresa, com
  `autorizado: true`; o JSON-LD nunca leva `aggregateRating` próprio.
