// Configurações institucionais da marca Vanpack.
// Valores vazios são intencionalmente omitidos no HTML gerado para garantir apenas dados reais.

export const siteConfig = {
  name: 'Vanpack',
  legalName: 'VanPack Embalagens',
  slogan: 'Do projeto à entrega',
  siteUrl: 'https://marcelo-franceschini.github.io/vanpack-pages/',
  whatsapp: process.env.VITE_WHATSAPP || '',
  phone: process.env.VITE_PHONE || '', // Se vazio, botão de chamada direta não é exibido
  cnpj: process.env.VITE_CNPJ || '', // Se vazio, não é renderizado
  email: process.env.VITE_EMAIL || '',
  address: {
    city: 'Santo André',
    state: 'SP',
    country: 'BR',
    street: process.env.VITE_STREET || '',
    postalCode: process.env.VITE_CEP || '',
  },
};
