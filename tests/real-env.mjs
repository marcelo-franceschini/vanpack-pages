// Dados "reais" só para os testes: tudo diferente do .env.example (menos o que já é real por natureza,
// como cidade e UF, e os diferenciais), para exercitar o modo production sem mexer no .env do projeto.
// Os clientes de exemplo saem (production sem cliente autorizado); um teste que precise de cliente o
// acrescenta.
export const realEnv = (example) => ({
  ...example,
  ...Object.fromEntries(
    Object.keys(example)
      .filter((key) => /^VITE_CLIENT_\d+_/.test(key))
      .map((key) => [key, '']),
  ),
  VITE_DATA_MODE: 'production',
  VITE_WHATSAPP: '5511987654321',
  VITE_PHONE: '+551147001234',
  VITE_PHONE_DISPLAY: '(11) 4700-1234',
  VITE_CNPJ: '11.222.333/0001-81',
  VITE_LEGAL_NAME: 'Vanpack Embalagens LTDA',
  VITE_STREET: 'Av. das Caixas, 500',
  VITE_DISTRICT: 'Distrito Industrial',
  VITE_CEP: '09000-100',
  VITE_HOURS: 'Seg a Sex, 7h30 às 17h30',
  VITE_HOURS_SCHEMA: 'Mo-Fr 07:30-17:30',
  VITE_MAP_URL: 'https://maps.google.com/?q=Av+das+Caixas+500',
  VITE_MIN_ORDER: '300',
  VITE_SERVICE_AREA: 'Grande São Paulo',
  VITE_PAYMENT_METHODS: 'Pix e boleto',
});
