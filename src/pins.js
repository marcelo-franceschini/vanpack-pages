// Callout pins didáticos sobre as máquinas na cena 3D.

const PINS_CONFIG = [
  { step: 0, num: '01', label: 'Chapa de papelão' },
  { step: 1, num: '02', label: 'Impressão com a sua marca' },
  { step: 2, num: '03', label: 'Corte e vinco' },
  { step: 3, num: '04', label: 'Montagem da caixa' },
  { step: 4, num: '05', label: 'Entrega' },
];

/**
 * @param {HTMLElement} container
 * @returns {{ update(anchors: Array<{ index: number, x: number, y: number, visible: boolean }>, activeStep: number): void }}
 */
export function createPins(container) {
  if (!container) return { update() {} };

  container.innerHTML = PINS_CONFIG.map(
    (pin) => `
    <div class="pin" data-pin="${pin.step}">
      <span class="pin-dot"></span>
      <span class="pin-stem"></span>
      <div class="pin-tag">
        <span class="pin-num">${pin.num}</span>
        <span class="pin-label">${pin.label}</span>
      </div>
    </div>
  `,
  ).join('');

  const elements = Array.from(container.querySelectorAll('.pin'));

  return {
    update(anchors, activeStep) {
      if (!anchors || !anchors.length) return;
      anchors.forEach(({ index, x, y, visible }) => {
        const el = elements[index];
        if (!el) return;
        el.style.left = `${x.toFixed(2)}%`;
        el.style.top = `${y.toFixed(2)}%`;
        const isActive = index === activeStep && visible;
        el.classList.toggle('active', isActive);
      });
    },
  };
}
