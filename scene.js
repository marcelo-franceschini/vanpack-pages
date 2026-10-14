// Cena 3D: chapa → impressão (2 cores) → corte e vinco → formação da caixa → caminhão vanpack.
// API: createScene(canvas, { mobile }) → { setProgress(p, t), resize(w, h), busy(p), setReduced(v), dispose() }
import * as THREE from 'three';

export function createScene(canvas, { mobile = false } = {}) {
const dpr = Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: dpr < 2, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setPixelRatio(dpr);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.localClippingEnabled = true;

const scene = new THREE.Scene();
const BG = 0xf1ece3;
scene.background = new THREE.Color(BG);
scene.fog = new THREE.Fog(BG, 13, 30);
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);

// Ambiente procedural (galpão com claraboias) → reflexos nos metais
{
  const env = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.47, 0.43), side: THREE.BackSide }));
  room.scale.set(30, 12, 30); room.position.y = 5; env.add(room);
  const panel = (w, h, x, y, z, k, rx = 0, ry = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.set(rx, ry, 0); env.add(m);
  };
  panel(14, 3, 0, 10.8, 0, 7, Math.PI / 2);
  panel(10, 4, -14.8, 5, 0, 3, 0, Math.PI / 2);
  panel(10, 3, 0, 5, 14.8, 2.4);
  panel(6, 2, 10, 4, -14.8, 1.6);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(env, 0.04).texture;
  pm.dispose();
}
scene.environmentIntensity = 0.6;
scene.add(new THREE.HemisphereLight(0xfffaf0, 0xb8a990, 0.65));
const sun = new THREE.DirectionalLight(0xffffff, 2.3);
const SM = mobile ? 1024 : 2048, SH = 6.5, SUN_OFF = new THREE.Vector3(3, 8, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(SM, SM);
sun.shadow.radius = 3;
Object.assign(sun.shadow.camera, { left: -SH, right: SH, top: SH, bottom: -SH, near: 0.5, far: 30 });
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.015;
scene.add(sun, sun.target);
const lDir = SUN_OFF.clone().normalize();
const lR = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), lDir).normalize();
const lU = new THREE.Vector3().crossVectors(lDir, lR).normalize();
const texel = (2 * SH) / SM, _s = new THREE.Vector3();
function placeSun(t) { // sombra acompanha a câmera, travada no texel (sem tremulação)
  const a = Math.round(t.dot(lR) / texel) * texel, b = Math.round(t.dot(lU) / texel) * texel;
  _s.copy(lR).multiplyScalar(a).addScaledVector(lU, b).addScaledVector(lDir, t.dot(lDir));
  sun.target.position.copy(_s); sun.position.copy(_s).add(SUN_OFF);
}

// ---------- Texturas (canvas, geradas uma vez) ----------
const tex = (w, h, draw, rep, srgb = true) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
};
const speckle = (g, w, h, n, a, cols) => { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${cols[i % cols.length]},${(Math.random() * a).toFixed(3)})`; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); } };
const kraftFill = (g, w, h) => { g.fillStyle = '#c4945e'; g.fillRect(0, 0, w, h); speckle(g, w, h, (w * h) / 22, 0.07, ['90,60,30', '235,200,150']); };
const kraftTex = tex(256, 256, kraftFill, [1, 1]);
const stackTex = tex(512, 512, (g, w, h) => {
  const L = 30, lh = h / L;
  for (let i = 0; i < L; i++) {
    const y0 = i * lh; g.fillStyle = i % 2 ? '#b98a59' : '#c39362'; g.fillRect(0, y0, w, lh);
    g.fillStyle = 'rgba(60,35,15,.35)'; g.fillRect(0, y0, w, 1.4);
    g.strokeStyle = 'rgba(105,68,34,.6)'; g.lineWidth = 1.3; g.beginPath();
    const ph = Math.random() * 6;
    for (let x = 0; x <= w; x += 2) { const y = y0 + lh / 2 + Math.sin((x / w) * Math.PI * 2 * 48 + ph) * (lh / 2 - 3); x ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
  }
});
const INK = [512, 420];
const inkTexA = tex(...INK, (g, w, h) => { g.fillStyle = '#2a1f14'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '800 74px Helvetica, Arial, sans-serif'; g.fillText('SEU LOGO', w / 2, h / 2 - 40); g.fillText('AQUI', w / 2, h / 2 + 42); });
const inkTexB = tex(...INK, (g, w, h) => { g.strokeStyle = '#c8452c'; g.lineWidth = 10; g.setLineDash([26, 16]); g.beginPath(); g.roundRect(34, 44, w - 68, h - 88, 30); g.stroke(); g.setLineDash([]); g.fillStyle = '#c8452c'; g.fillRect(w / 2 - 70, h / 2 + 96, 140, 9); });
const printedTex = tex(...INK, (g, w, h) => { kraftFill(g, w, h); g.drawImage(inkTexB.image, 0, 0); g.drawImage(inkTexA.image, 0, 0); });
const dieTex = tex(512, 256, (g, w, h) => {
  g.fillStyle = '#d6b07d'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 50; i++) { g.strokeStyle = `rgba(150,100,55,${(Math.random() * 0.22).toFixed(3)})`; g.lineWidth = 1 + Math.random() * 2; g.beginPath(); const y = Math.random() * h; for (let x = 0; x <= w; x += 16) { const yy = y + Math.sin(x * 0.02 + i) * 3; x ? g.lineTo(x, yy) : g.moveTo(x, yy); } g.stroke(); }
  g.fillStyle = '#e0607a';
  [[40, 30, 432, 10], [40, 216, 432, 10], [30, 40, 10, 176], [472, 40, 10, 176], [150, 40, 8, 176], [354, 40, 8, 176]].forEach(r => g.fillRect(...r));
  g.strokeStyle = '#2d2d2d'; g.lineWidth = 3; g.strokeRect(46, 44, 420, 168);
  g.beginPath(); g.moveTo(160, 44); g.lineTo(160, 212); g.moveTo(352, 44); g.lineTo(352, 212); g.stroke();
});
const hazardTex = tex(128, 128, (g, w, h) => { g.fillStyle = '#e3b23c'; g.fillRect(0, 0, w, h); g.fillStyle = '#1d1d1d'; for (let k = -1; k < 5; k++) { const x = k * 64; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 32, 0); g.lineTo(x + 32 - h, h); g.lineTo(x - h, h); g.closePath(); g.fill(); } }, [1, 1]);
const labelTex = tex(512, 128, g => {
  const tri = (cx, sym) => { g.fillStyle = '#e3b23c'; g.strokeStyle = '#1d1d1d'; g.lineWidth = 8; g.lineJoin = 'round'; g.beginPath(); g.moveTo(cx, 14); g.lineTo(cx + 54, 112); g.lineTo(cx - 54, 112); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#1d1d1d'; g.strokeStyle = '#1d1d1d'; sym(cx); };
  tri(64, cx => { g.font = '900 58px Arial, sans-serif'; g.textAlign = 'center'; g.fillText('!', cx, 102); });
  tri(192, cx => { g.beginPath(); g.moveTo(cx + 8, 40); g.lineTo(cx - 14, 80); g.lineTo(cx + 2, 80); g.lineTo(cx - 8, 106); g.lineTo(cx + 18, 66); g.lineTo(cx + 2, 66); g.closePath(); g.fill(); });
  tri(320, cx => { g.lineWidth = 6; g.beginPath(); g.arc(cx - 11, 84, 14, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(cx + 15, 84, 10, 0, Math.PI * 2); g.stroke(); });
  g.fillStyle = '#c9ced2'; g.fillRect(392, 24, 112, 80); g.fillStyle = '#3a3f44'; g.fillRect(402, 34, 60, 10);
  for (let i = 0; i < 4; i++) g.fillRect(402, 54 + i * 12, 92 - i * 14, 5);
});
const screenTex = tex(256, 160, (g, w, h) => {
  g.fillStyle = '#0f2a33'; g.fillRect(0, 0, w, h); g.fillStyle = '#1f5c4a'; g.fillRect(0, 0, w, 22);
  g.fillStyle = '#9fd8c3'; [44, 70, 58, 90, 76, 100].forEach((bh, i) => g.fillRect(18 + i * 26, 140 - bh, 16, bh));
  g.fillStyle = '#e3b23c'; g.fillRect(186, 40, 52, 30); g.fillStyle = '#cfe9df'; for (let i = 0; i < 4; i++) g.fillRect(186, 82 + i * 14, 52 - i * 8, 6);
});
const slatTex = tex(64, 64, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#eceeef'); gr.addColorStop(0.84, '#d3d7da'); gr.addColorStop(0.86, '#8d9296'); gr.addColorStop(1, '#bcc0c4'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, [1, 12]);
const beltTex = tex(128, 64, (g, w, h) => { g.fillStyle = '#2c2d2f'; g.fillRect(0, 0, w, h); speckle(g, w, h, 700, 0.14, ['255,255,255', '0,0,0']); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, 0, 6, h); }, [1, 1]);
const grimeTex = tex(64, 256, (g, w, h) => { const gr = g.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, '#9a958e'); gr.addColorStop(0.22, '#e8e6e2'); gr.addColorStop(1, '#ffffff'); g.fillStyle = gr; g.fillRect(0, 0, w, h); speckle(g, w, h, 900, 0.08, ['0,0,0', '255,255,255']); }, [1, 0.7]);
const blobTex = tex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(0,0,0,.5)'); gr.addColorStop(0.55, 'rgba(0,0,0,.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, null, false);
const brandTex = tex(1024, 320, (g, w, h) => { g.fillStyle = '#1f5c4a'; g.textBaseline = 'middle'; g.textAlign = 'center'; g.font = 'bold 190px Helvetica, Arial, sans-serif'; g.fillText('vanpack', w / 2, h / 2 + 6); });

// ---------- Materiais ----------
const M = (color, rough = 0.6, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
const PY = 0.55, T = 0.012;                       // linha de passagem e espessura da chapa
const FEED_X = -5.9, P1X = -4.25, P2X = -3.2, DX = -1.65, FX = 0.35;
const clipA = new THREE.Plane(new THREE.Vector3(1, 0, 0), -P1X);
const clipB = new THREE.Plane(new THREE.Vector3(1, 0, 0), -P2X);
const clipC = new THREE.Plane(new THREE.Vector3(1, 0, 0), -DX);
const mat = {
  frame: M(0x4a5a63, 0.55, 0.25, { map: grimeTex }), frameDark: M(0x2e373c, 0.6, 0.2),
  yellow: M(0xe3b23c, 0.45, 0.1), hazard: M(0xffffff, 0.5, 0.1, { map: hazardTex }),
  steel: M(0xb9bec4, 0.32, 0.85), gear: M(0x8d949a, 0.38, 0.8), chrome: M(0xe2e6ea, 0.1, 1), alu: M(0xd2d6da, 0.3, 0.9), galv: M(0xa9afb4, 0.45, 0.7),
  rubber: M(0x1c1c1d, 0.85), dark: M(0x1d1f21, 0.7, 0.2), cable: M(0x232527, 0.55, 0.1),
  kraft: M(0xffffff, 0.92, 0, { map: kraftTex }), stackSide: M(0xffffff, 0.95, 0, { map: stackTex }), printed: M(0xffffff, 0.9, 0, { map: printedTex }),
  wood: M(0xffffff, 0.75, 0, { map: dieTex }), anvil: M(0xd8732f, 0.6), plate: M(0x2f6f73, 0.45, 0.05), pallet: M(0xb88a55, 0.85),
  inkA: M(0x2a1f14, 0.3), inkB: M(0xc8452c, 0.3), bucket: M(0xdcdcd6, 0.55),
  poly: M(0xd8eef2, 0.08, 0, { transparent: true, opacity: 0.16, depthWrite: false }),
  belt: M(0xffffff, 0.85, 0, { map: beltTex }), cabinet: M(0xcdd1cd, 0.5, 0.15),
  labels: M(0xffffff, 0.5, 0, { map: labelTex, alphaTest: 0.5 }),
  screen: M(0x000000, 0.3, 0, { emissive: 0xffffff, emissiveMap: screenTex }),
  led: M(0xffffff, 0.3, 0, { emissive: 0xf4f7ff, emissiveIntensity: 1.6 }), redLed: M(0x8a1a12, 0.4, 0, { emissive: 0xff3a22, emissiveIntensity: 1.2 }),
  towerG: M(0x1f7a46, 0.35, 0, { emissive: 0x2fd06a }), towerA: M(0x9a6a10, 0.35, 0, { emissive: 0xffb020 }), towerR: M(0x7a1a14, 0.35, 0, { emissive: 0xff3020, emissiveIntensity: 0.05 }),
  btnG: M(0x3aa36a, 0.4), btnB: M(0x2f6fb0, 0.4), red: M(0xc8302a, 0.4),
  floor: M(0xe6dfd3, 0.95), line: M(0xe3b23c, 0.7),
  white: M(0xf4f2ee, 0.42, 0.05), green: M(0x1f5c4a, 0.42, 0.15), glass: M(0x1e2a33, 0.08, 0.6),
  lamp: M(0xfff4d6, 0.3, 0, { emissive: 0xfff0c0, emissiveIntensity: 0.8 }), tail: M(0xc8302a, 0.3, 0, { emissive: 0x801010, emissiveIntensity: 0.5 }),
  door: M(0xffffff, 0.45, 0.3, { map: slatTex }), darkDS: M(0x1d1f21, 0.7, 0.2, { side: THREE.DoubleSide }),
  brand: new THREE.MeshStandardMaterial({ map: brandTex, transparent: true, roughness: 0.5 }),
  blob: new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, color: 0x000000 }),
  decalA: new THREE.MeshStandardMaterial({ map: inkTexA, transparent: true, depthWrite: false, roughness: 0.5, clippingPlanes: [clipA], polygonOffset: true, polygonOffsetFactor: -2 }),
  decalB: new THREE.MeshStandardMaterial({ map: inkTexB, transparent: true, depthWrite: false, roughness: 0.5, clippingPlanes: [clipB], polygonOffset: true, polygonOffsetFactor: -3 }),
  crease: M(0x7d5530, 0.9, 0, { clippingPlanes: [clipC], polygonOffset: true, polygonOffsetFactor: -1 }),
};

// ---------- Helpers ----------
const ROOT = new THREE.Group();                   // estáticos → mesclados por material
const add = (geo, m, x = 0, y = 0, z = 0, parent = ROOT) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const bb = (x0, x1, y0, y1, z0, z1, m, parent) => add(B(x1 - x0, y1 - y0, z1 - z0), m, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, parent);
const zr = (s, a, b) => (s > 0 ? [a, b] : [-b, -a]);
const cyl = (r, len, m, x, y, z, axis = 'y', parent = ROOT, seg = 24) => { const o = add(new THREE.CylinderGeometry(r, r, len, seg), m, x, y, z, parent); if (axis === 'z') o.rotation.x = Math.PI / 2; if (axis === 'x') o.rotation.z = Math.PI / 2; return o; };
const tube = (pts, r, m, parent = ROOT) => add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), 40, r, 8), m, 0, 0, 0, parent);
const flat = (o) => { o.castShadow = false; return o; };
function rr(p, x, y, w, h, r) { p.moveTo(x + r, y); p.lineTo(x + w - r, y); p.quadraticCurveTo(x + w, y, x + w, y + r); p.lineTo(x + w, y + h - r); p.quadraticCurveTo(x + w, y + h, x + w - r, y + h); p.lineTo(x + r, y + h); p.quadraticCurveTo(x, y + h, x, y + h - r); p.lineTo(x, y + r); p.quadraticCurveTo(x, y, x + r, y); }
const FZ = 0.86, FT = 0.07;                       // z das laterais da máquina e espessura
function plate(x0, x1, y0, y1, zc, m = mat.frame, holes = []) {
  const s = new THREE.Shape(); rr(s, x0, y0, x1 - x0, y1 - y0, 0.035);
  for (const [a, b, c, d] of holes) { const h = new THREE.Path(); rr(h, a, b, c - a, d - b, 0.04); s.holes.push(h); }
  const d = FT - 0.012;
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 5 });
  g.translate(0, 0, zc - d / 2);
  return add(g, m);
}
const boltGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.01, 6);
const bolt = (x, y, z) => { const o = add(boltGeo, mat.steel, x, y, z + 0.004); o.rotation.x = Math.PI / 2; flat(o); };
function foot(x, z) { cyl(0.05, 0.02, mat.steel, x, 0.01, z); cyl(0.014, 0.05, mat.steel, x, 0.04, z, 'y', ROOT, 10); add(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 6), mat.steel, x, 0.05, z); }
function label(cell, size, x, y, z, ry = 0) {
  const g = new THREE.PlaneGeometry(size, size), uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, (cell + uv.getX(i)) / 4);
  const o = flat(add(g, mat.labels, x, y, z)); o.rotation.y = ry; return o;
}
function blob(x, z, w, d, parent = ROOT) { const o = add(new THREE.PlaneGeometry(w, d), mat.blob, x, 0.004, z, parent); o.rotation.x = -Math.PI / 2; o.castShadow = o.receiveShadow = false; o.renderOrder = -1; return o; }
const gearCache = new Map();
function gearGeo(r) {
  if (gearCache.has(r)) return gearCache.get(r);
  const n = Math.max(10, Math.round(r / 0.0072)), ro = r + 0.008, ri = r - 0.008, s = new THREE.Shape();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, d = (Math.PI * 2) / n;
    [[ri, 0], [ro, 0.22], [ro, 0.5], [ri, 0.72]].forEach(([rad, f], k) => { const x = Math.cos(a + d * f) * rad, y = Math.sin(a + d * f) * rad; (i || k) ? s.lineTo(x, y) : s.moveTo(x, y); });
  }
  if (r > 0.09) for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2, h = new THREE.Path(); h.absarc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.2, 0, Math.PI * 2, true); s.holes.push(h); }
  const hub = new THREE.Path(); hub.absarc(0, 0, 0.022, 0, Math.PI * 2, true); s.holes.push(hub);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1, curveSegments: 10 });
  g.translate(0, 0, -0.015); gearCache.set(r, g); return g;
}
const spin = [];                                  // rolos/engrenagens que giram com o avanço
function roll(x, y, r, m, dir, gearR) {
  const g = new THREE.Group(); g.position.set(x, y, 0); scene.add(g);
  cyl(r, 2 * FZ - FT, m, 0, 0, 0, 'z', g, 40);
  cyl(Math.min(0.03, r * 0.4), 2 * FZ + 0.12, mat.steel, 0, 0, 0, 'z', g, 12);
  if (gearR) add(gearGeo(gearR), mat.gear, 0, 0, FZ + FT / 2 + 0.035, g);
  cyl(0.05, 0.024, mat.frameDark, x, y, FZ + FT / 2 + 0.012, 'z');
  cyl(0.05, 0.024, mat.frameDark, x, y, -FZ - FT / 2 - 0.012, 'z');
  spin.push([g, gearR || r, dir]);
  return g;
}
function unitFrame(x0, x1, top, windows = []) {
  plate(x0, x1, 0.06, top, -FZ);
  plate(x0, x1, 0.06, top, FZ, mat.frame, windows);
  for (const x of [x0 + 0.07, x1 - 0.07]) for (const z of [-FZ, FZ]) foot(x, z);
  bb(x0 + 0.06, x1 - 0.06, 0.14, 0.28, -FZ + FT / 2, FZ - FT / 2, mat.frameDark);
  for (let x = x0 + 0.08; x < x1 - 0.04; x += 0.14) { bolt(x, 0.12, FZ + FT / 2); bolt(x, top - 0.06, FZ + FT / 2); }
}
function topCover(x0, x1, top) {
  for (const x of [x0 + 0.03, x1 - 0.03]) bb(x - 0.03, x + 0.03, top, top + 0.05, -FZ - 0.04, FZ + 0.04, mat.yellow);
  for (const z of [-FZ, FZ]) bb(x0, x1, top, top + 0.05, z - 0.04, z + 0.04, mat.yellow);
  flat(add(B(x1 - x0 - 0.12, 0.008, 2 * FZ - 0.08), mat.poly, (x0 + x1) / 2, top + 0.035, 0));
}

// ---------- Piso ----------
const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), mat.floor);
floor.rotation.x = -Math.PI / 2; floor.position.x = 4; floor.receiveShadow = true; scene.add(floor);
for (const s of [-1, 1]) flat(bb(-7.7, 1.55, 0.001, 0.003, ...zr(s, 1.32, 1.38), mat.line));
for (const x of [-7.7, 1.55]) flat(bb(x - 0.03, x + 0.03, 0.001, 0.003, -1.38, 1.38, mat.line));

// ---------- Alimentador (pilha de chapas) ----------
const BW = 0.55, BD = 0.45, BH = 0.42, SL = BW + 2 * BH, SW = BD + 2 * BH, STACK_H = 0.36;
{
  const x0 = -6.8, x1 = -4.85;
  unitFrame(x0, x1, PY + 0.12);
  bb(x0 + 0.04, x1 - 0.04, PY - 0.035, PY - 0.001, -FZ + FT / 2, FZ - FT / 2, mat.dark);
  for (const z of [-FZ, FZ]) bb(-5.2, -5.1, PY + 0.12, PY + 0.86, z - 0.035, z + 0.035, mat.frame);
  bb(-5.22, -5.08, PY + 0.78, PY + 0.88, -FZ - 0.035, FZ + 0.035, mat.frame);
  for (const z of [-0.42, 0, 0.42]) bb(-5.2, -5.18, PY + T + 0.006, PY + 0.78, z - 0.08, z + 0.08, mat.steel);
  for (const z of [-FZ, FZ]) bb(-6.74, -6.66, PY + 0.12, PY + 0.6, z - 0.035, z + 0.035, mat.frame);
  cyl(0.02, 2 * FZ, mat.steel, -6.7, PY + 0.52, 0, 'z');
  for (const z of [-0.3, 0.3]) bb(-6.64, -6.61, PY + 0.01, PY + 0.56, z - 0.1, z + 0.1, mat.steel);
  for (const s of [-1, 1]) for (const x of [-6.25, -5.55]) {
    bb(x - 0.015, x + 0.015, PY + 0.01, PY + 0.5, ...zr(s, 0.652, 0.664), mat.steel);
    bb(x - 0.015, x + 0.015, PY + 0.44, PY + 0.47, ...zr(s, 0.664, FZ), mat.steel);
  }
  roll(-4.98, PY - 0.055, 0.055, mat.rubber, -1, 0.061);
  roll(-4.98, PY + T + 0.055, 0.055, mat.rubber, 1, 0.061);
  cyl(0.012, 0.26, mat.steel, -5.15, PY + 1.0, FZ, 'y', ROOT, 10);
  [[mat.towerR, 1.31], [mat.towerA, 1.24], [mat.towerG, 1.17]].forEach(([m, y]) => cyl(0.035, 0.065, m, -5.15, PY + y, FZ, 'y', ROOT, 20));
  cyl(0.037, 0.012, mat.frameDark, -5.15, PY + 1.35, FZ, 'y', ROOT, 20);
  label(3, 0.12, -6.45, 0.42, FZ + FT / 2 + 0.003);
  label(0, 0.1, -5.4, 0.42, FZ + FT / 2 + 0.003);
  blob(-5.85, 0, 2.6, 2.4);
}
const stack = new THREE.Mesh(B(SL, STACK_H, SW), [mat.stackSide, mat.stackSide, mat.kraft, mat.kraft, mat.stackSide, mat.stackSide]);
stack.castShadow = stack.receiveShadow = true; scene.add(stack);
const STACK_Y = PY + T + STACK_H / 2;
stack.position.set(FEED_X, STACK_Y, 0);

// Painel de comando (IHM) em braço articulado
{
  const hx = -6.95, hz = 1.0;
  bb(hx - 0.1, hx + 0.1, 0, 0.02, hz - 0.1, hz + 0.1, mat.steel);
  cyl(0.035, 1.82, mat.steel, hx, 0.92, hz);
  cyl(0.03, 0.44, mat.steel, hx, 1.8, hz + 0.2, 'z');
  cyl(0.02, 0.14, mat.steel, hx, 1.73, hz + 0.42);
  const pn = new THREE.Group(); pn.position.set(hx, 1.5, hz + 0.44); pn.rotation.y = -0.35; ROOT.add(pn);
  add(B(0.46, 0.34, 0.09), mat.cabinet, 0, 0, 0, pn);
  flat(add(new THREE.PlaneGeometry(0.3, 0.19), mat.screen, -0.05, 0.03, 0.046, pn));
  [mat.btnG, mat.towerA, mat.btnB].forEach((m, i) => cyl(0.016, 0.02, m, 0.17, 0.1 - i * 0.055, 0.05, 'z', pn, 14));
  cyl(0.032, 0.02, mat.yellow, 0.17, -0.11, 0.05, 'z', pn, 20);
  cyl(0.024, 0.03, mat.red, 0.17, -0.11, 0.065, 'z', pn, 20);
}

// ---------- Unidades impressoras (flexo, 2 cores) ----------
function printUnit(cx, inkM) {
  const x0 = cx - 0.5, x1 = cx + 0.5, top = 1.28;
  unitFrame(x0, x1, top, [[x0 + 0.09, PY - 0.12, cx - 0.17, PY + 0.47], [cx + 0.17, PY - 0.12, x1 - 0.09, PY + 0.47]]);
  topCover(x0, x1, top);
  const rI = 0.085, rP = 0.125, rA = 0.07, yI = PY - rI, yP = PY + T + rP + 0.006;
  roll(cx, yI, rI, mat.steel, -1, 0.095);
  const pc = roll(cx, yP, rP, mat.steel, 1, 0.133);
  const pl = add(new THREE.CylinderGeometry(rP + 0.006, rP + 0.006, 1.28, 48, 1, false, 0, 3.6), mat.plate, 0, 0, 0, pc); pl.rotation.x = Math.PI / 2;
  const a = 2.45, d = rP + 0.006 + rA, ax = cx + Math.cos(a) * d, ay = yP + Math.sin(a) * d;
  roll(ax, ay, rA, mat.chrome, -1, 0.068);
  const chx = ax + Math.cos(a) * (rA + 0.045), chy = ay + Math.sin(a) * (rA + 0.045);
  add(B(0.08, 0.12, 1.48), mat.frameDark, chx, chy, 0).rotation.z = a;
  add(B(0.012, 0.1, 1.44), inkM, ax + Math.cos(a) * (rA + 0.006), ay + Math.sin(a) * (rA + 0.006), 0).rotation.z = a;
  const bx = cx - 0.3;
  tube([[chx, chy, 0.72], [cx - 0.27, 0.86, 0.9], [bx, 0.66, 1.08], [bx, 0.44, 1.2], [bx, 0.36, 1.2]], 0.013, inkM);
  tube([[chx, chy - 0.05, 0.72], [cx - 0.24, 0.8, 0.92], [bx + 0.06, 0.6, 1.1], [bx + 0.06, 0.4, 1.18], [bx + 0.06, 0.34, 1.18]], 0.012, mat.cable);
  cyl(0.13, 0.34, mat.bucket, bx, 0.17, 1.2, 'y', ROOT, 28);
  cyl(0.118, 0.01, inkM, bx, 0.336, 1.2, 'y', ROOT, 28);
  bb(bx + 0.17, bx + 0.33, 0, 0.12, 1.1, 1.26, mat.frameDark);
  cyl(0.045, 0.14, mat.btnB, bx + 0.25, 0.17, 1.18, 'x', ROOT, 16);
  cyl(0.016, 0.8, mat.steel, cx, 1.12, FZ + 0.1, 'x', ROOT, 12);
  for (const x of [x0 + 0.12, x1 - 0.12]) cyl(0.012, 0.07, mat.steel, x, 1.12, FZ + 0.065, 'z', ROOT, 10);
  label(0, 0.1, x0 + 0.2, top - 0.1, FZ + FT / 2 + 0.003);
  blob(cx, 0.1, 1.5, 2.2);
}
printUnit(P1X, mat.inkA);
printUnit(P2X, mat.inkB);

// Mesa de transferência + inspeção por câmera
{
  const x0 = -2.7, x1 = -2.2;
  plate(x0, x1, 0.06, PY - 0.03, -FZ); plate(x0, x1, 0.06, PY - 0.03, FZ);
  for (const x of [x0 + 0.07, x1 - 0.07]) for (const z of [-FZ, FZ]) foot(x, z);
  bb(x0, x1, PY - 0.03, PY - 0.002, -0.72, 0.72, mat.dark);
  for (const z of [-FZ, FZ]) bb(-2.47, -2.41, PY - 0.03, 1.46, z - 0.03, z + 0.03, mat.frame);
  bb(-2.48, -2.4, 1.4, 1.48, -FZ - 0.03, FZ + 0.03, mat.frame);
  flat(bb(-2.47, -2.41, 1.36, 1.4, -0.66, 0.66, mat.led));
  bb(-2.5, -2.38, 1.28, 1.4, -0.07, 0.07, mat.frameDark);
  cyl(0.025, 0.04, mat.glass, -2.44, 1.26, 0, 'y', ROOT, 16);
}

// ---------- Corte e vinco rotativo ----------
{
  const x0 = -2.2, x1 = -1.1, top = 1.36;
  unitFrame(x0, x1, top, [[x0 + 0.09, PY - 0.1, DX - 0.25, PY + 0.52], [DX + 0.25, PY - 0.1, x1 - 0.09, PY + 0.52]]);
  topCover(x0, x1, top);
  const rAv = 0.16, rD = 0.2, yAv = PY - rAv, yD = PY + T + rD + 0.016;
  roll(DX, yAv, rAv, mat.anvil, -1, 0.172);
  const dc = roll(DX, yD, rD, mat.steel, 1, 0.216);
  add(new THREE.CylinderGeometry(rD + 0.016, rD + 0.016, 1.34, 56, 1, false, 0, 4.2), mat.wood, 0, 0, 0, dc).rotation.x = Math.PI / 2;
  bb(DX + 0.18, x1 - 0.03, PY - 0.32, PY - 0.3, -FZ + 0.04, FZ - 0.04, mat.dark);
  bb(DX + 0.17, x1, PY - 0.014, PY - 0.001, -0.2, 0.2, mat.steel);
  cyl(0.016, 0.9, mat.steel, DX, 1.2, FZ + 0.1, 'x', ROOT, 12);
  for (const x of [x0 + 0.12, x1 - 0.12]) cyl(0.012, 0.07, mat.steel, x, 1.2, FZ + 0.065, 'z', ROOT, 10);
  label(0, 0.1, x0 + 0.2, top - 0.1, FZ + FT / 2 + 0.003);
  label(2, 0.1, x1 - 0.2, top - 0.1, FZ + FT / 2 + 0.003);
  blob(DX, 0, 1.6, 2.2);
}

// ---------- Esteira de saída + estação formadora ----------
const BELT_X0 = -1.1, BELT_X1 = 3.25, GH = 2.06, HEAD_REST = 1.24;
{
  bb(BELT_X0, BELT_X1, PY - 0.03, PY, -0.35, 0.35, mat.belt);
  for (const s of [-1, 1]) bb(BELT_X0, BELT_X1, PY - 0.1, PY - 0.006, ...zr(s, 0.35, 0.39), mat.steel);
  for (const x of [BELT_X0, BELT_X1]) cyl(0.032, 0.72, mat.steel, x, PY - 0.032, 0, 'z');
  for (let x = BELT_X0 + 0.25; x < BELT_X1; x += 1.0) {
    for (const s of [-1, 1]) { bb(x - 0.025, x + 0.025, 0.06, PY - 0.1, ...zr(s, 0.35, 0.39), mat.steel); foot(x, s * 0.37); }
    bb(x - 0.02, x + 0.02, 0.2, 0.24, -0.35, 0.35, mat.steel);
  }
  blob((BELT_X0 + BELT_X1) / 2, 0, BELT_X1 - BELT_X0 + 0.4, 1.2);
  const xa = FX - 0.62, xb = FX + 0.62, zc = 0.98;
  for (const x of [xa, xb]) for (const z of [-zc, zc]) {
    bb(x - 0.04, x + 0.04, 0.02, GH, z - 0.04, z + 0.04, mat.yellow);
    bb(x - 0.043, x + 0.043, 0.02, 0.32, z - 0.043, z + 0.043, mat.hazard);
    bb(x - 0.08, x + 0.08, 0, 0.02, z - 0.08, z + 0.08, mat.steel);
  }
  for (const z of [-zc, zc]) bb(xa - 0.04, xb + 0.04, GH, GH + 0.08, z - 0.04, z + 0.04, mat.yellow);
  for (const x of [xa, xb]) bb(x - 0.04, x + 0.04, GH, GH + 0.08, -zc, zc, mat.yellow);
  bb(FX - 0.08, FX + 0.08, GH - 0.1, GH + 0.08, -zc, zc, mat.frame);
  cyl(0.075, 0.44, mat.alu, FX, GH - 0.36, 0, 'y', ROOT, 32);
  bb(FX - 0.09, FX + 0.09, GH - 0.6, GH - 0.56, -0.09, 0.09, mat.frameDark);
  bb(FX - 0.09, FX + 0.09, GH - 0.14, GH - 0.1, -0.09, 0.09, mat.frameDark);
  bb(FX - 0.2, FX + 0.2, GH - 0.66, GH - 0.62, -0.06, 0.06, mat.frameDark);
  bb(FX + 0.1, FX + 0.28, GH + 0.08, GH + 0.16, -0.08, 0.08, mat.steel);
  tube([[FX + 0.19, GH + 0.12, 0.08], [FX + 0.14, GH - 0.05, 0.14], [FX + 0.08, GH - 0.3, 0.1]], 0.008, mat.btnB);
  for (const z of [-zc - 0.1, zc + 0.1]) { bb(xa - 0.13, xa - 0.08, 0.25, 1.6, z - 0.025, z + 0.025, mat.dark); flat(bb(xa - 0.08, xa - 0.074, 0.3, 1.55, z - 0.01, z + 0.01, mat.redLed)); }
  label(0, 0.09, xa, 1.1, zc + 0.041);
  blob(FX, 0, 1.8, 2.4);
}
const head = new THREE.Group(); head.position.set(FX, HEAD_REST, 0); scene.add(head);
add(B(0.48, 0.04, 0.38), mat.alu, 0, 0.065, 0, head);
add(B(0.2, 0.05, 0.12), mat.frameDark, 0, 0.11, 0, head);
for (const x of [-0.16, 0, 0.16]) for (const z of [-0.11, 0.11]) {
  cyl(0.012, 0.02, mat.steel, x, 0.035, z, 'y', head, 10);
  add(new THREE.CylinderGeometry(0.032, 0.022, 0.025, 16), mat.rubber, x, 0.0125, z, head);
}
const rod = cyl(0.025, 1, mat.chrome, FX, 1, 0, 'y', scene, 16);
const guides = [-0.15, 0.15].map(dx => cyl(0.014, 1, mat.chrome, FX + dx, 1, 0, 'y', scene, 12));

// ---------- Painel elétrico, eletrocalha e paletes ----------
{
  const x0 = -5.5, x1 = -4.1, z0 = -1.82, z1 = -1.38, mx = (x0 + x1) / 2;
  bb(x0, x1, 0, 0.1, z0 + 0.02, z1 - 0.02, mat.frameDark);
  bb(x0, x1, 0.1, 2.1, z0, z1, mat.cabinet);
  flat(bb(mx - 0.004, mx + 0.004, 0.14, 2.06, z1, z1 + 0.004, mat.dark));
  for (const x of [mx - 0.08, mx + 0.08]) bb(x - 0.015, x + 0.015, 1.0, 1.2, z1, z1 + 0.025, mat.dark);
  for (const [a, b] of [[x0 + 0.15, x0 + 0.5], [x1 - 0.5, x1 - 0.15]]) for (let i = 0; i < 6; i++) flat(bb(a, b, 0.3 + i * 0.04, 0.315 + i * 0.04, z1, z1 + 0.003, mat.dark));
  label(1, 0.13, x0 + 0.33, 1.72, z1 + 0.004);
  label(3, 0.13, x1 - 0.33, 1.72, z1 + 0.004);
  cyl(0.025, 0.03, mat.towerG, x1 - 0.2, 1.92, z1 + 0.015, 'z', ROOT, 16);
  cyl(0.025, 0.03, mat.towerR, x1 - 0.3, 1.92, z1 + 0.015, 'z', ROOT, 16);
  blob(mx, -1.6, 1.9, 0.9);
  const ty = 1.72, tz0 = -1.12, tz1 = -0.92;
  bb(-5.3, 0.15, ty - 0.012, ty, tz0, tz1, mat.galv);
  for (const z of [tz0, tz1]) bb(-5.3, 0.15, ty, ty + 0.06, z - 0.004, z + 0.004, mat.galv);
  for (const x of [-4.6, -3.7, -2.9, -1.9, -1.2, -0.3]) bb(x - 0.02, x + 0.02, 0.95, ty - 0.012, -0.935, -0.9, mat.galv);
  for (const [x, i] of [[-4.75, 0], [-4.6, 1], [-4.45, 2]]) tube([[x, 2.1, -1.6], [x, 2.24, -1.5], [x, 2.05, -1.08], [x, ty + 0.02, -1.02]], 0.012, mat.cable);
  for (const x of [P1X + 0.3, P2X + 0.3, DX + 0.35]) tube([[x, ty + 0.02, -1.02], [x + 0.04, 1.55, -0.98], [x + 0.06, 1.38, -0.92], [x + 0.06, 1.3, -0.9]], 0.012, mat.cable);
  tube([[0.1, ty + 0.03, -1.02], [0.0, 1.95, -1.0], [FX - 0.62, GH + 0.04, -0.98]], 0.012, mat.cable);
}
function pallet(x, z) {
  for (const dz of [-0.42, 0, 0.42]) bb(x - 0.6, x + 0.6, 0, 0.022, z + dz - 0.05, z + dz + 0.05, mat.pallet);
  for (const dx of [-0.52, 0, 0.52]) for (const dz of [-0.42, 0, 0.42]) bb(x + dx - 0.05, x + dx + 0.05, 0.022, 0.12, z + dz - 0.05, z + dz + 0.05, mat.pallet);
  for (let i = 0; i < 7; i++) bb(x - 0.6, x + 0.6, 0.12, 0.142, z - 0.5 + i * 0.1667 - 0.045, z - 0.5 + i * 0.1667 + 0.045, mat.pallet);
  blob(x, z, 1.6, 1.4);
}
pallet(-3.7, -2.15);
{
  const m = new THREE.Mesh(B(SL, 0.5, SW), [mat.stackSide, mat.stackSide, mat.kraft, mat.kraft, mat.stackSide, mat.stackSide]);
  m.position.set(-3.7, 0.142 + 0.25, -2.15); m.castShadow = m.receiveShadow = true; ROOT.add(m);
  for (const dx of [-0.35, 0.35]) bb(-3.7 + dx - 0.015, -3.7 + dx + 0.015, 0.14, 0.648, -2.15 - SW / 2 - 0.004, -2.15 + SW / 2 + 0.004, mat.dark);
}
pallet(2.1, -1.85);
for (let i = 0; i < 8; i++) {
  const lx = (i & 1) ? 0.3 : -0.3, lz = (i & 2) ? 0.25 : -0.25, ly = (i & 4) ? 1 : 0;
  bb(2.1 + lx - BW / 2 + 0.01, 2.1 + lx + BW / 2 - 0.01, 0.142 + ly * BH, 0.142 + (ly + 1) * BH - 0.004, -1.85 + lz - BD / 2 + 0.01, -1.85 + lz + BD / 2 - 0.01, mat.printed);
}

// ---------- A chapa / caixa (peças articuladas) ----------
const blank = new THREE.Group(); scene.add(blank);
const piece = (w, d, parent, x, y, z) => { const m = new THREE.Mesh(B(w, T, d), mat.kraft); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
const decal = (w, h, m, parent, x, y, z, flip, order) => { const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); o.position.set(x, y, z); o.rotation.set(-Math.PI / 2, flip ? Math.PI : 0, 0, 'YXZ'); o.renderOrder = order; o.receiveShadow = true; parent.add(o); return o; };
piece(BW, BD, blank, 0, T / 2, 0);
decal(BW * 0.9, BD * 0.9, mat.decalA, blank, 0, T + 0.0008, 0, false, 1);
decal(BW * 0.9, BD * 0.9, mat.decalB, blank, 0, T + 0.0014, 0, false, 2);
const pivots = [];
for (const [ax, s] of [['x', 1], ['x', -1], ['z', 1], ['z', -1]]) {
  const pv = new THREE.Group(); blank.add(pv); pivots.push(pv);
  if (ax === 'x') { pv.position.set(s * BW / 2, T / 2, 0); piece(BH, BD, pv, s * BH / 2, 0, 0); }
  else {
    pv.position.set(0, T / 2, s * BD / 2); piece(BW, BH, pv, 0, 0, s * BH / 2);
    decal(BW * 0.9, BH * 0.9, mat.decalA, pv, 0, T / 2 + 0.0008, s * BH / 2, s < 0, 1);
    decal(BW * 0.9, BH * 0.9, mat.decalB, pv, 0, T / 2 + 0.0014, s * BH / 2, s < 0, 2);
  }
}
for (const [w, d, x, z] of [[BW, 0.006, 0, BD / 2], [BW, 0.006, 0, -BD / 2], [0.006, BD, BW / 2, 0], [0.006, BD, -BW / 2, 0]]) {
  const c = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat.crease); c.rotation.x = -Math.PI / 2; c.position.set(x, T + 0.0004, z); blank.add(c);
}
const corners = [];
for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
  const c = piece(BH, BH, blank, sx * (BW / 2 + BH / 2), T / 2, sz * (BD / 2 + BH / 2));
  c.userData = { lx: c.position.x, lz: c.position.z }; corners.push(c);
}

// ---------- Caminhão vanpack ----------
const CX0 = 3.3, CX1 = 5.2, CY0 = PY, CY1 = 1.95, CZ = 0.82, TW = 0.04, WR = 0.32;
const truck = new THREE.Group(); scene.add(truck);
const body = new THREE.Group(); body.position.set(3.85, WR, 0); truck.add(body);
const inner = new THREE.Group(); inner.position.set(-3.85, -WR, 0); body.add(inner);
const TB = new THREE.Group();
{
  bb(CX0, CX1, CY0 - TW, CY0, -CZ, CZ, mat.white, TB);
  bb(CX0, CX1, CY1 - TW, CY1, -CZ, CZ, mat.white, TB);
  bb(CX1 - TW, CX1, CY0, CY1, -CZ, CZ, mat.white, TB);
  bb(CX0 + 0.06, CX0 + 0.28, CY1 - 0.24, CY1 - TW, -CZ + TW, CZ - TW, mat.white, TB);
  for (const s of [-1, 1]) {
    bb(CX0, CX1, CY0, CY1, ...zr(s, CZ - TW, CZ), mat.white, TB);
    bb(CX0, CX1, CY0 + 0.06, CY0 + 0.15, ...zr(s, CZ, CZ + 0.004), mat.green, TB);
    flat(add(new THREE.PlaneGeometry(1.55, 0.48), mat.brand, (CX0 + CX1) / 2, 1.3, s * (CZ + 0.006), TB)).rotation.y = s < 0 ? Math.PI : 0;
    bb(CX0, CX1, CY1 - 0.03, CY1 + 0.01, ...zr(s, CZ - 0.025, CZ + 0.012), mat.alu, TB);
    bb(CX0, CX1, CY0 - 0.07, CY0 - 0.03, ...zr(s, CZ - 0.025, CZ + 0.012), mat.alu, TB);
    bb(CX1 - 0.03, CX1 + 0.012, CY0 - 0.04, CY1, ...zr(s, CZ - 0.025, CZ + 0.012), mat.alu, TB);
    bb(CX0 - 0.01, CX0 + 0.06, CY0 - 0.04, CY1 + 0.02, ...zr(s, CZ - 0.07, CZ + 0.005), mat.green, TB);
    bb(CX0 - 0.016, CX0 - 0.004, 0.62, 0.8, ...zr(s, CZ - 0.06, CZ - 0.01), mat.tail, TB);
    bb(3.45, 3.47, 0.08, 0.46, ...zr(s, 0.55, 0.81), mat.rubber, TB);
    const fl = add(new THREE.TorusGeometry(0.39, 0.022, 8, 28, 2.443), mat.dark, 5.75, WR, s * 0.802, TB); fl.rotation.z = 0.349;
  }
  bb(CX0 - 0.01, CX0 + 0.06, CY1 - 0.1, CY1 + 0.02, -CZ, CZ, mat.green, TB);
  const well = add(new THREE.CylinderGeometry(0.38, 0.38, 1.6, 28, 1, true, 1.92, 2.443), mat.darkDS, 5.75, WR, 0, TB); well.rotation.x = Math.PI / 2;
  bb(3.05, 6.15, 0.31, 0.45, -0.5, 0.5, mat.dark, TB);
  bb(CX0 - 0.09, CX0 + 0.04, 0.33, 0.45, -0.86, 0.86, mat.dark, TB);
  bb(CX0 - 0.1, CX0 - 0.09, 0.345, 0.435, -0.16, 0.16, mat.white, TB);
  const prof = new THREE.Shape();
  prof.moveTo(CX1, 0.45); prof.lineTo(5.393, 0.45); prof.absarc(5.75, WR, 0.38, Math.PI - 0.349, 0.349, true); prof.lineTo(6.3, 0.45); prof.lineTo(6.3, 1.0); prof.lineTo(5.95, 1.58); prof.lineTo(CX1, 1.62); prof.closePath();
  const cabGeo = new THREE.ExtrudeGeometry(prof, { depth: 1.56, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3 });
  cabGeo.translate(0, 0, -0.78);
  add(cabGeo, mat.green, 0, 0, 0, TB);
  const wsLen = Math.hypot(0.35, 0.58);
  flat(add(B(wsLen - 0.1, 0.01, 1.4), mat.glass, (6.3 + 5.95) / 2 + 0.02, (1.0 + 1.58) / 2 + 0.012, 0, TB)).rotation.z = Math.atan2(0.58, -0.35);
  for (const s of [-1, 1]) {
    bb(5.34, 5.86, 1.06, 1.44, ...zr(s, 0.8, 0.81), mat.glass, TB);
    for (const [x, y0] of [[5.3, 0.5], [5.92, 0.74]]) flat(bb(x - 0.004, x + 0.004, y0, 1.5, ...zr(s, 0.8, 0.804), mat.dark, TB));
    bb(5.38, 5.46, 0.98, 1.0, ...zr(s, 0.8, 0.82), mat.dark, TB);
    bb(5.98, 6.0, 1.18, 1.22, ...zr(s, 0.8, 0.9), mat.dark, TB);
    bb(5.96, 6.0, 1.06, 1.3, ...zr(s, 0.88, 0.94), mat.dark, TB);
    bb(6.3, 6.34, 0.8, 0.9, ...zr(s, 0.44, 0.66), mat.lamp, TB);
  }
  bb(6.28, 6.4, 0.44, 0.6, -0.83, 0.83, mat.dark, TB);
  bb(6.3, 6.32, 0.66, 0.84, -0.36, 0.36, mat.dark, TB);
  blob(4.8, 0, 3.8, 2.3, TB);
}
inner.add(merge(TB));
const DH = CY1 - 0.1 - CY0;
const doorPivot = new THREE.Group(); doorPivot.position.set(CX0 + 0.02, CY1 - 0.1, 0); inner.add(doorPivot);
const doorGeo = B(0.02, DH, 2 * CZ - 0.14); doorGeo.translate(0, -DH / 2, 0);
const door = add(doorGeo, mat.door, 0, 0, 0, doorPivot);
const doorHandle = add(B(0.03, 0.03, 0.3), mat.dark, -0.02, 0, 0, doorPivot);
const wheels = [];
for (const x of [3.85, 5.75]) for (const s of [-1, 1]) {
  const w = new THREE.Group(); w.position.set(x, WR, s * 0.68); truck.add(w); wheels.push(w);
  cyl(WR, 0.24, mat.rubber, 0, 0, 0, 'z', w, 40);
  cyl(0.2, 0.245, mat.steel, 0, 0, 0, 'z', w, 32);
  cyl(0.075, 0.26, mat.dark, 0, 0, 0, 'z', w, 20);
  for (let k = 0; k < 6; k++) cyl(0.014, 0.02, mat.chrome, Math.cos(k * 1.047) * 0.12, Math.sin(k * 1.047) * 0.12, s * 0.125, 'z', w, 8);
}

// ---------- Mescla dos estáticos (poucos draw calls) ----------
function merge(root) {
  root.updateMatrixWorld(true);
  const buckets = new Map(), out = new THREE.Group();
  root.traverse(o => {
    if (!o.isMesh) return;
    if (Array.isArray(o.material)) { const c = new THREE.Mesh(o.geometry, o.material); o.matrixWorld.decompose(c.position, c.quaternion, c.scale); c.castShadow = c.receiveShadow = true; out.add(c); return; }
    const k = o.material.uuid + (o.castShadow ? 1 : 0) + (o.renderOrder || 0);
    let b = buckets.get(k); if (!b) buckets.set(k, b = { m: o.material, s: o.castShadow, r: o.receiveShadow, ro: o.renderOrder, list: [] });
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(o.matrixWorld); b.list.push(g);
  });
  for (const { m, s, r, ro, list } of buckets.values()) {
    let n = 0; list.forEach(g => (n += g.attributes.position.count));
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    let o = 0;
    for (const g of list) { const c = g.attributes.position.count; pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2); o += c; g.dispose(); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, m); mesh.castShadow = s; mesh.receiveShadow = r; mesh.renderOrder = ro; out.add(mesh);
  }
  return out;
}
scene.add(merge(ROOT));
beltTex.repeat.set((BELT_X1 - BELT_X0) / 0.25, 1);

// ---------- Linha do tempo (p = 0…1 do scroll) ----------
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = t => t * t * (3 - 2 * t);
const seg = (p, a, b) => ease(clamp((p - a) / (b - a)));
const lerp = (a, b, t) => a + (b - a) * t;
const keys = [
  [0.00, [-8.6, 3.3, 6.4], [-5.5, 0.8, 0]],
  [0.17, [-5.9, 3.0, 5.6], [-3.8, 0.75, 0]],
  [0.34, [-3.3, 2.9, 4.1], [-2.45, 0.62, 0]],
  [0.46, [-2.2, 3.2, 5.0], [-1.2, 0.7, 0]],
  [0.57, [-0.8, 2.6, 4.4], [0.35, 0.9, 0]],
  [0.67, [0.95, 1.7, 3.3], [0.45, 0.8, 0]],
  [0.79, [1.6, 2.4, 5.2], [3.4, 1.05, 0]],
  [0.87, [1.9, 2.3, 5.8], [4.0, 1.05, 0]],
  [1.00, [5.0, 2.8, 9.0], [7.5, 1.0, 0]],
];
let distK = 1;
const _p = new THREE.Vector3(), _t = new THREE.Vector3();
function camAt(p) {
  let i = 0; while (i < keys.length - 2 && p > keys[i + 1][0]) i++;
  const [p0, a0, t0] = keys[i], [p1, a1, t1] = keys[i + 1];
  const t = ease(clamp((p - p0) / (p1 - p0)));
  _p.set(lerp(a0[0], a1[0], t), lerp(a0[1], a1[1], t), lerp(a0[2], a1[2], t));
  _t.set(lerp(t0[0], t1[0], t), lerp(t0[1], t1[1], t), lerp(t0[2], t1[2], t));
  camera.position.copy(_p.sub(_t).multiplyScalar(distK).add(_t));
  camera.lookAt(_t);
  placeSun(_t);
}

const LIFT = BH - T / 2, BOX_END = 4.3;
let reduced = false;
function setProgress(p) {
  let x;
  if (p < 0.4) x = lerp(FEED_X, -2.45, seg(p, 0.06, 0.33));
  else if (p < 0.64) x = lerp(-2.45, FX, seg(p, 0.40, 0.50));
  else x = lerp(FX, BOX_END, seg(p, 0.64, 0.79));
  const drive = clamp((p - 0.88) / 0.12), dx = drive * drive * 10;
  const h = LIFT * seg(p, 0.53, 0.60);
  blank.position.set(x + (p > 0.8 ? dx : 0), PY + h, 0);
  const a = Math.asin(clamp(h / LIFT));          // abas dobram enquanto a ventosa ergue o centro
  pivots[0].rotation.z = -a; pivots[1].rotation.z = a; pivots[2].rotation.x = a; pivots[3].rotation.x = -a;
  for (const c of corners) {                      // refiles caem após a faca rotativa
    const start = DX + BH / 2 - c.userData.lx, f = clamp((x - start) / 0.3);
    c.visible = f < 1;
    c.position.set(c.userData.lx - (f > 0 ? x - start : 0) + 0.1 * f, T / 2 - 0.5 * f * f, c.userData.lz);
    c.rotation.set(0.9 * f * Math.sign(c.userData.lz), 0, -0.4 * f);
  }
  stack.position.y = STACK_Y - T * clamp((x - (FEED_X + SL)) / 0.08);
  const dn = seg(p, 0.50, 0.53), up = seg(p, 0.60, 0.635);
  const hy = p < 0.53 ? lerp(HEAD_REST, PY + T, dn) : p < 0.60 ? PY + T + h : lerp(PY + T + LIFT, HEAD_REST, up);
  head.position.y = hy;
  const ya = GH - 0.6, yb = hy + 0.135; rod.scale.y = ya - yb; rod.position.y = (ya + yb) / 2;
  for (const g of guides) { const y2 = GH - 0.64, y3 = hy + 0.085; g.scale.y = y2 - y3; g.position.y = (y2 + y3) / 2; }
  const travel = Math.min(x, BOX_END) - FEED_X;
  for (const [g, r, dir] of spin) g.rotation.z = (dir * travel) / r;
  beltTex.offset.x = -travel / 0.25;
  const run = p > 0.06 && p < 0.64;
  mat.towerG.emissiveIntensity = run ? 2.2 : 0.05;
  mat.towerA.emissiveIntensity = run ? 0.05 : 1.6;
  const close = Math.max(0.02, seg(p, 0.79, 0.86));
  door.scale.y = close; slatTex.repeat.y = (close * DH) / 0.09; doorHandle.position.y = -DH * close + 0.05;
  truck.position.x = dx;
  for (const w of wheels) w.rotation.z = -dx / WR;
  body.rotation.z = 0.02 * Math.sin(Math.PI * clamp(drive * 2.5)) * (1 - drive);
  camAt(p);
  renderer.render(scene, camera);
}

function resize(w, h) {
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  const aspect = w / h, portrait = aspect < 1;
  camera.aspect = aspect;
  camera.fov = portrait ? 42 : 35;
  distK = portrait ? clamp(1.25 / aspect, 1.2, 2.1) : aspect < 1.4 ? 1.15 : 1;
  if (portrait) camera.setViewOffset(w, h, 0, h * 0.14, w, h);
  else camera.setViewOffset(w, h, -w * (aspect > 1.5 ? 0.2 : 0.13), 0, w, h);
  camera.updateProjectionMatrix();
}

return { setProgress, resize, busy: () => false, setReduced: v => { reduced = v; }, dispose: () => renderer.dispose() };
}
