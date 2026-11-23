// Gatilho do 3D dos produtos, a única parte dele no JS inicial: nada do 3D é baixado nem executado
// antes de os cartões chegarem a 300 px da tela. Aí o montar.js (chunk próprio) decide entre o 3D e a
// ilustração em SVG, que ocupa o mesmo espaço reservado.

/** Troca a área do 3D pela ilustração em SVG da peça (public/produtos/<modelo>.svg). */
export function ilustrar(area) {
  area.querySelector('canvas')?.remove();
  if (area.querySelector('img')) return;
  const modelo = area.dataset.modelo || area.dataset.model;
  const peca = area.dataset.peca || area.dataset.piece || modelo;
  const img = new Image(400, 300);
  img.alt = `Ilustração de ${peca}`;
  img.decoding = 'async';
  img.src = `./produtos/${modelo}.svg`; // relativo à página (subcaminho do GitHub Pages)
  area.append(img);
  area.classList.add('pronto');
}

export function observeProdutos() {
  const list = document.querySelector('.models, .product-cards');
  const areas = /** @type {HTMLElement[]} */ ([
    ...document.querySelectorAll('.model-3d[data-modelo], .model-3d[data-model]'),
  ]);
  if (!list || !areas.length) return;
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      import('./montar.js').then(
        ({ montarProdutos }) => montarProdutos(areas),
        () => areas.forEach(ilustrar),
      );
    },
    { rootMargin: '300px 0px' },
  );
  observer.observe(list);
}
