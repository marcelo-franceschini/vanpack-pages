// Worker do 3D dos produtos: o único contexto WebGL dos cartões (OffscreenCanvas). A página manda o
// que está perto (monta o modelo), o que está à vista (desenha) e o tamanho de cada cartão; o worker
// devolve um ImageBitmap por cartão à vista, a 30 quadros por segundo, e espera a página receber antes
// de desenhar o seguinte. Com movimento reduzido desenha uma vez, parado. Sem DOM.
//
// página → worker: init, add, remove, resize, visible, pause, resume, reduced, ack, dispose
// (e, só no build de auditoria, audit-lose e audit-memory)
// worker → página: ready, error, frame, lost, restored, stats, disposed
import { createVitrine } from './cena.js';

const FPS = 30;
const TURN = (2 * Math.PI) / 20; // rad/s: uma volta em 20 s
const POSE = 0; // de frente e de lado para a câmera (a pose parada do movimento reduzido)
const PHASE = 0.5; // rad entre um cartão e o seguinte, para os 3 não girarem em uníssono
const AUDIT = import.meta.env.MODE === 'audit';

let canvas = null;
let vitrine = null;
/** @type {Map<number, { width: number, height: number, visible: boolean }>} */
const cards = new Map();
let reduced = false;
let paused = false;
let lost = false;
let waiting = false; // a página ainda não recebeu o último quadro
let dirty = true; // há algo novo a desenhar (vale no movimento reduzido)
let scheduled = false;
let last = 0;
let angle = 0;

const schedule =
  typeof requestAnimationFrame === 'function'
    ? (cb) => requestAnimationFrame(cb)
    : (cb) => setTimeout(() => cb(performance.now()), 1000 / FPS);

const anyVisible = () => [...cards.values()].some((card) => card.visible);

function wake() {
  if (scheduled || !vitrine || lost || paused || waiting || !anyVisible()) return;
  if (reduced && !dirty) return;
  scheduled = true;
  schedule(frame);
}

function frame(now) {
  scheduled = false;
  if (!vitrine || lost || paused || waiting) return;
  if (!reduced && !dirty && last && now - last < 1000 / FPS - 4) {
    wake();
    return;
  }
  if (!reduced) angle += last ? Math.min(0.1, (now - last) / 1000) * TURN : 0;
  last = now;
  dirty = false;
  const frames = [];
  const stats = {};
  for (const [id, card] of cards) {
    if (!card.visible) continue;
    const yaw = reduced ? POSE : POSE + angle + id * PHASE;
    if (!vitrine.render(id, card.width, card.height, yaw)) continue;
    frames.push({ id, bitmap: canvas.transferToImageBitmap() });
    if (AUDIT) stats[id] = vitrine.stats();
  }
  if (!frames.length) return;
  waiting = true;
  self.postMessage(
    { type: 'frame', frames, ...(AUDIT && { stats }) },
    frames.map((f) => f.bitmap),
  );
}

const memory = () => {
  if (!AUDIT || !vitrine) return;
  const { geometries, textures, programs, models } = vitrine.stats();
  self.postMessage({ type: 'stats', memory: { geometries, textures, programs, models } });
};

function init(msg) {
  reduced = msg.reduced;
  paused = msg.hidden;
  try {
    canvas = new OffscreenCanvas(1, 1);
    vitrine = createVitrine(canvas);
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err?.message ?? err) });
    return;
  }
  // O sistema pode derrubar o contexto (comum no celular): para e, ao voltar, reenvia as texturas.
  canvas.addEventListener('webglcontextlost', () => {
    if (!vitrine) return; // o dispose também perde o contexto, de propósito
    lost = true;
    self.postMessage({ type: 'lost' });
  });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false;
    vitrine?.restore();
    dirty = true;
    self.postMessage({ type: 'restored' });
    wake();
  });
  self.postMessage({ type: 'ready' });
}

self.onmessage = ({ data: msg }) => {
  if (msg.type === 'init') return init(msg);
  if (!vitrine) return;
  const card = cards.get(msg.id);
  switch (msg.type) {
    case 'add':
      try {
        vitrine.add(msg.id, msg.modelo);
      } catch (err) {
        self.postMessage({ type: 'error', message: String(err?.message ?? err) });
        return;
      }
      cards.set(msg.id, { width: msg.width, height: msg.height, visible: msg.visible });
      dirty = true;
      memory();
      break;
    case 'remove':
      vitrine.remove(msg.id);
      cards.delete(msg.id);
      memory();
      break;
    case 'resize':
      if (card) Object.assign(card, { width: msg.width, height: msg.height });
      dirty = true;
      break;
    case 'visible':
      if (card) card.visible = msg.on;
      dirty = true;
      last = 0;
      break;
    case 'pause':
      paused = true;
      break;
    case 'resume':
      paused = false;
      last = 0;
      break;
    case 'reduced':
      reduced = msg.value;
      dirty = true;
      break;
    case 'ack':
      waiting = false;
      break;
    case 'dispose': {
      const done = vitrine;
      vitrine = null;
      cards.clear();
      done.dispose();
      self.postMessage({ type: 'disposed' });
      return;
    }
    case 'audit-memory':
      memory();
      break;
    case 'audit-lose': {
      if (!AUDIT) break;
      // perde e devolve o contexto, para testar a recuperação
      const ext = canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context');
      ext?.loseContext();
      setTimeout(() => ext?.restoreContext(), 200);
      break;
    }
    default:
  }
  wake();
};
