# Experimentos A/B

Hoje **nenhum experimento está ligado**: a infraestrutura está pronta (`src/experiments.js`) e há um
só experimento configurado, o `quote_wizard`. Não existe experimento que tire a animação 3D da página
(decisão do dono: a página precisa se explicar sozinha).

## Como funciona

- A configuração está em `site.config.js` (`experiments`): `enabled`, `variants`, `split` (pesos, na
  ordem das variantes) e `endsAt` (data fixa; depois dela só vale a variante A).
- O sorteio é no navegador, uma vez por visita, guardado só no `sessionStorage`: o site não usa cookies
  nem `localStorage` (sem banner não há consentimento). Quem volta em outra sessão pode cair na outra
  variante, então com pouco tráfego trate o resultado como direção, não como prova.
- `?exp_<nome>=A|B` na URL força a variante (QA e testes), mesmo com o experimento desligado.
- O `<html>` ganha `data-exp_<nome>` e todo evento (dataLayer e Umami, inclusive o `visit_summary`) leva
  `exp_<nome>`. Experimento desligado não marca nada.

## Regras

1. Defina a métrica principal, o tamanho de amostra e a data de término **antes** de ligar.
2. Rode semanas completas e não pare ao "ver significância" (olhar antes da hora infla os falsos
   positivos). Se usar uma ferramenta nova, rode um A/A antes.
3. Calcule a amostra com `npm run amostra -- <taxa_atual> <taxa_alvo>`. Exemplo: de 5% para 6% de
   conversão pedem ~8.150 visitantes **por variante**. Com menos de ~2.000 visitas por mês isso não
   fecha: nesse tráfego, prefira antes e depois (4 semanas cada) e leitura qualitativa, e use o A/B só
   para mudanças grandes.

## `quote_wizard`

- **Hipótese:** trocar o CTA final por um assistente de 3 passos (produto, medidas e quantidade,
  impressão) que monta a mensagem do WhatsApp aumenta as **conversas qualificadas por 100 visitas**,
  mesmo que o número de cliques caia: quem chega ao WhatsApp já traz medida, quantidade e impressão.
- **Variante A:** o CTA final de hoje (botão de WhatsApp com a mensagem curta, sem campos para preencher).
  **Variante B:** o assistente (`src/wizard.js`, carregado só nessa variante); o botão final tem o código
  de origem `[site-orcamento-assistente]`, e o da A, `[site-orcamento]`.
- **Métrica principal:** conversas qualificadas por 100 visitas, contadas pelo código `[site-*]` da
  primeira mensagem (planilha semanal do atendimento). Qualificada é a conversa com medida e
  quantidade, dentro da região atendida.
- **Guardrails:** LCP p75 no celular de até 2,5 s (o `visit_summary` leva o `lcp` de cada visita, por
  variante), taxa de erro de JavaScript, e a proporção de conversas fora da região.
- **Amostra:** `npm run amostra -- 0.05 0.06` (ajuste as taxas à conversão real antes de ligar).
- **Término:** `endsAt` fixo em `site.config.js`; ao passar a data só a A vale, sem novo deploy.
- **Exceção à regra "sem formulário":** o assistente usa controles soltos (`<input>`, rótulos, botões),
  **sem `<form>`**, criados por JavaScript só na variante B, com teclado, foco no passo e validação no
  lugar. O `brand.test` veta `<form>`, `<input>`, `<select>` e `<textarea>` no HTML estático (a página
  como é servida); a variante B é a única exceção e nada do que se digita sai do navegador, a não ser na
  mensagem que a própria pessoa envia pelo WhatsApp.

## Como ligar

1. Em `site.config.js`, `experiments.quote_wizard`: `enabled: true` e uma data em `endsAt` (de 4 a 8
   semanas à frente, conforme a amostra).
2. Rode `npm test`, abra o PR e faça o merge. Confira as duas variantes com `?exp_quote_wizard=A` e `=B`.
3. Ao fim, leia a métrica, decida e remova o código da variante que perdeu.
