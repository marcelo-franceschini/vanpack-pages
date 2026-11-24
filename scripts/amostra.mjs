// Tamanho de amostra por variante de um teste A/B de taxas (duas proporções, teste bicaudal): quantos
// visitantes cada variante precisa para detectar a diferença. Defina antes de ligar o experimento.
// Uso: node scripts/amostra.mjs <taxa_atual> <taxa_alvo> [alfa=0.05] [poder=0.8]
// Ex.: npm run amostra -- 0.05 0.06   (de 5% para 6% de conversão: ~8.150 visitantes por variante)
const Z_ALFA = { 0.1: 1.6449, 0.05: 1.96, 0.01: 2.5758 }; // bicaudal
const Z_PODER = { 0.8: 0.8416, 0.9: 1.2816, 0.95: 1.6449 };

const [p1, p2, alfa = 0.05, poder = 0.8] = process.argv.slice(2).map(Number);
if (
  !(p1 > 0 && p1 < 1 && p2 > 0 && p2 < 1 && p1 !== p2) ||
  !(alfa in Z_ALFA) ||
  !(poder in Z_PODER)
) {
  console.error('Uso: node scripts/amostra.mjs <taxa_atual> <taxa_alvo> [alfa=0.05] [poder=0.8]');
  console.error('Taxas entre 0 e 1 e diferentes; alfa 0.1, 0.05 ou 0.01; poder 0.8, 0.9 ou 0.95.');
  process.exit(2);
}
const z = Z_ALFA[alfa] + Z_PODER[poder];
const porVariante = Math.ceil((z ** 2 * (p1 * (1 - p1) + p2 * (1 - p2))) / (p2 - p1) ** 2);
console.log(
  `De ${(p1 * 100).toFixed(1)}% para ${(p2 * 100).toFixed(1)}% (alfa ${alfa}, poder ${poder}):`,
);
console.log(
  `  ${porVariante.toLocaleString('pt-BR')} visitantes por variante, ${(2 * porVariante).toLocaleString('pt-BR')} no total`,
);
