# Logos dos clientes

Ponha aqui o logo de cada cliente que autorizou a divulgação, e só em SVG (vetor).

- Nome do arquivo: minúsculas, sem acento, palavras separadas por hífen. Ex.: `padaria-real.svg`.
- Tamanho: até 20 KB. O site otimiza o arquivo sozinho ao publicar (sem mudar o desenho).
- O SVG precisa ter `viewBox`, e não pode ter script, imagem embutida (PNG, JPG) nem link para fora.
- Depois de pôr o arquivo, cadastre o cliente em `content/clientes.yaml` (nome, logo, autorizado) e
  registre a autorização em `docs/provas/<nome-do-cliente>.md`.

O site só mostra em production o cliente com `autorizado: true`. Sem logo, aparece o nome em texto.
