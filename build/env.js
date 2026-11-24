// Leitura de arquivos .env fora do Vite (o `.env.example` não é de nenhum modo do Vite, e o `loadEnv`
// deixa as variáveis do processo vencerem, o que falsearia a comparação com o exemplo).

/** Lê o texto de um .env (CHAVE=valor, # comentário, aspas simples ou duplas) num objeto. */
export function parseEnv(text) {
  const env = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.length >= 2 && value.endsWith(quote)) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, ''); // comentário no fim da linha
    }
    env[key] = value;
  }
  return env;
}
