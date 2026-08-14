// The clawdarium tank — the live aquarium hub.
//
// One glass tank, one crab per animation. Crabs wander the sand; hovering one
// raises its name tag, clicking one opens its clip in an overlay. Scenes are
// discovered from manifest.json (+ private/manifest.json, which only exists
// locally — on GitHub Pages that fetch 404s and those crabs simply never swim).
//
// This page is live-only and never captured, so unlike scenes it may keep
// state and use real randomness.

import {
  PX, SIZE, GW, GH, initCanvas, px, pxh, mix, rnd,
  drawClawd, drawText, textWidth, CLAWD
} from '../engine/engine';

const WATER = {
  frame:  '#241a12', frameHi: '#4a3a28',
  glass:  '#bfe8e2',
  air:    '#0d1b22',
  top:    '#1a4a54', bottom: '#0a2029',
  foam:   '#c8ece6', ray: '#9fd8cc',
  sandHi: '#c8a86a', sand: '#a8874e', sandLow: '#7a5f33',
  kelp:   '#2f7a58', kelpDark: '#1e5a40',
  fish:   '#7fb3c2',
  tagInk: '#f2e9da', tagShadow: '#10262c',
  title:  '#a8d8ce'
};

// tank geometry, in grid rows
const WATERLINE = 3;      // first water row
const SAND_TOP = 27;      // back edge of the sand
const INNER_L = 1, INNER_R = GH - 2;   // inside the glass

interface Crab {
  name: string;
  label: string;
  dir: string;            // '' for public scenes, 'private/' for local ones
  x: number;              // grid col, left edge of the body
  y: number;              // grid row, fixed depth lane
  target: number;
  speed: number;
  restUntil: number;      // seconds; standing still until then
  seed: number;
}

const crabs: Crab[] = [];
let hovered: Crab | null = null;
let running = true;

const cv = document.getElementById('c') as HTMLCanvasElement;
const ctx = initCanvas(cv);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ─── SET DRESSING ────────────────────────────────────────────

function drawTankFrame() {
  for (let g = 0; g < GW; g++) {
    px(g, 0, WATER.frame); px(g, GH - 1, WATER.frame);
  }
  for (let g = 0; g < GH; g++) {
    px(0, g, WATER.frame); px(GW - 1, g, WATER.frame);
  }
  // one glass glint down the left pane
  for (let g = 4; g < 12; g++) px(1, g, WATER.glass, 0.18);
  for (let g = 14; g < 17; g++) px(1, g, WATER.glass, 0.10);
}

function drawWater(sec: number) {
  // the air gap above the waterline
  for (let gy = 1; gy < WATERLINE; gy++)
    for (let gx = INNER_L; gx <= INNER_R; gx++) px(gx, gy, WATER.air);
  // banded water, darker with depth
  for (let gy = WATERLINE; gy < GH - 1; gy++) {
    const p = (gy - WATERLINE) / (GH - 2 - WATERLINE);
    const col = mix(WATER.top, WATER.bottom, p);
    for (let gx = INNER_L; gx <= INNER_R; gx++) px(gx, gy, col);
  }
  // the surface: foam pixels sliding slowly
  for (let gx = INNER_L; gx <= INNER_R; gx++) {
    const w = Math.sin(sec * 1.4 + gx * 0.9);
    px(gx, WATERLINE, WATER.foam, 0.35 + 0.2 * w);
    if (w > 0.55) px(gx, WATERLINE + 1, WATER.foam, 0.12);
  }
  // light rays leaning through the water
  for (const r of [7, 16, 26]) {
    const drift = Math.sin(sec * 0.3 + r) * 1.5;
    for (let gy = WATERLINE + 1; gy < SAND_TOP + 3; gy++) {
      const gx = Math.round(r + drift + (gy - WATERLINE) * 0.35);
      const a = 0.10 * (1 - (gy - WATERLINE) / 26);
      if (gx > INNER_L && gx < INNER_R) {
        px(gx, gy, WATER.ray, a);
        px(gx + 1, gy, WATER.ray, a * 0.6);
      }
    }
  }
}

function drawSand() {
  for (let gy = SAND_TOP; gy < GH - 1; gy++) {
    const p = (gy - SAND_TOP) / (GH - 1 - SAND_TOP);
    const col = mix(WATER.sandHi, WATER.sand, p);
    for (let gx = INNER_L; gx <= INNER_R; gx++) {
      // a soft back-to-front slope: the top sand row is ragged
      if (gy === SAND_TOP && rnd(gx * 7) > 0.55) continue;
      px(gx, gy, col);
    }
  }
  for (let i = 0; i < 60; i++) {                // speckle
    const gx = INNER_L + Math.floor(rnd(i * 5 + 2) * (INNER_R - INNER_L));
    const gy = SAND_TOP + 1 + Math.floor(rnd(i * 3 + 7) * (GH - 3 - SAND_TOP));
    px(gx, gy, rnd(i) > 0.5 ? WATER.sandLow : WATER.sandHi, 0.6);
  }
}

function drawKelp(sec: number) {
  const stalks = [{ gx: 4, h: 14 }, { gx: 30, h: 17 }, { gx: 33, h: 10 }];
  for (const s of stalks) {
    for (let i = 0; i < s.h; i++) {
      const gy = SAND_TOP - i;
      // sways more toward the tip
      const sway = Math.round(Math.sin(sec * 0.9 + s.gx + i * 0.35) * (i / s.h) * 1.8);
      const gx = s.gx + sway;
      px(gx, gy, i % 3 === 2 ? WATER.kelpDark : WATER.kelp);
      if (i % 4 === 1) px(gx + (i % 8 < 4 ? 1 : -1), gy, WATER.kelpDark, 0.8);
    }
  }
}

function drawBubbles(sec: number) {
  for (let k = 0; k < 10; k++) {
    const col = INNER_L + 1 + rnd(k * 7 + 3) * (INNER_R - INNER_L - 2);
    const speed = 1.6 + rnd(k * 11) * 2.2;                 // rows per second
    const span = SAND_TOP - WATERLINE - 1;
    const gy = SAND_TOP - ((sec * speed + rnd(k * 13) * span) % span);
    const wob = Math.sin(sec * 3 + k) * 0.5;
    const a = 0.55 * Math.min(1, (gy - WATERLINE) / 3);    // fade at surface
    pxh((col + wob) * 2, gy * 2, WATER.foam, a);
  }
}

function drawFish(sec: number) {
  const lanes = [{ y: 8, speed: 2.6, dir: 1 }, { y: 13, speed: 1.8, dir: -1 }, { y: 19, speed: 3.4, dir: 1 }];
  for (let i = 0; i < lanes.length; i++) {
    const f = lanes[i];
    const spanH = (INNER_R - INNER_L + 8) * 2;
    let hx = (sec * f.speed * 2 + i * 23) % spanH;
    if (f.dir === -1) hx = spanH - hx;
    hx += INNER_L * 2 - 4;
    const hy = f.y * 2 + Math.round(Math.sin(sec * 2 + i) * 1);
    pxh(hx, hy, WATER.fish, 0.75); pxh(hx + f.dir, hy, WATER.fish, 0.75);
    pxh(hx - f.dir, hy - (i % 2), WATER.fish, 0.5);        // tail
  }
}

function drawTitle() {
  drawText('CLAWDARIUM', 6, SIZE / 2 + 6, 1.2 * PX + 6, WATER.tagShadow, 0.5);
  drawText('CLAWDARIUM', 6, SIZE / 2, 1.2 * PX, WATER.title, 0.9);
}

// ─── CRABS ───────────────────────────────────────────────────
// depth lanes: back crabs stand higher on the sand slope and draw first
const LANES = [19, 21, 23];
const X_MIN = INNER_L + 1, X_MAX = INNER_R - CLAWD.width;

function spawnCrab(name: string, dir: string, i: number) {
  const lane = LANES[i % LANES.length];
  const x = X_MIN + rnd(i * 31 + 5) * (X_MAX - X_MIN);
  crabs.push({
    name, dir,
    label: name.replace(/^gossip-/, '').replace(/-/g, ' ').toUpperCase(),
    x, y: lane, target: x,
    speed: 2.2 + rnd(i * 17) * 1.4,
    restUntil: rnd(i * 7) * 4,
    seed: i * 97 + 13
  });
}

function updateCrab(c: Crab, sec: number, dt: number) {
  if (sec < c.restUntil) return;
  if (Math.abs(c.x - c.target) < 0.3) {
    // arrived: rest a while, then pick a new spot on the sand
    c.restUntil = sec + 1.5 + Math.random() * 4;
    c.target = X_MIN + Math.random() * (X_MAX - X_MIN);
    return;
  }
  c.x += Math.sign(c.target - c.x) * c.speed * dt;
}

function drawCrab(c: Crab, sec: number) {
  const walking = sec >= c.restUntil && Math.abs(c.x - c.target) >= 0.3;
  const step = walking && Math.sin(sec * 9 + c.seed) > 0.3 ? -1 : 0;
  const blink = (sec * 24 + c.seed) % 90 >= 87;
  const eyes = blink ? 'blink'
    : walking ? (c.target > c.x ? 'look_right' : 'look_left')
    : (c === hovered ? 'look_up' : 'forward');
  // back lanes sit deeper in the water: tint them toward it so two
  // overlapping crabs stay two crabs instead of one blob
  const depth = (LANES[LANES.length - 1] - c.y) / (LANES[LANES.length - 1] - LANES[0]);
  const body = depth > 0 ? mix(CLAWD.body, WATER.bottom, depth * 0.38) : CLAWD.body;
  drawClawd(Math.round(c.x), c.y + step, { eyes, body });
}

function drawTag(c: Crab) {
  const cx = (Math.round(c.x) + CLAWD.width / 2) * PX;
  const topY = (c.y - 2.4) * PX;
  const w = textWidth(c.label, 4) + 24;
  ctx.fillStyle = WATER.tagShadow;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(Math.round(cx - w / 2), topY - 10, w, 4 * 9 + 20);
  ctx.globalAlpha = 1;
  drawText(c.label, 4, cx, topY, WATER.tagInk);
}

// ─── LOOP ────────────────────────────────────────────────────

let last = 0;
function frame(ts: number) {
  const sec = ts / 1000;
  const dt = Math.min(0.05, (ts - last) / 1000);
  last = ts;

  drawWater(sec);
  drawKelp(sec);
  drawFish(sec);
  drawSand();
  for (const c of crabs) updateCrab(c, sec, dt);
  for (const c of [...crabs].sort((a, b) => a.y - b.y)) drawCrab(c, sec);
  drawBubbles(sec);
  drawTitle();
  drawTankFrame();
  if (hovered) drawTag(hovered);

  if (running && !reduced) requestAnimationFrame(frame);
}

// ─── INPUT ───────────────────────────────────────────────────

function crabAt(clientX: number, clientY: number): Crab | null {
  const r = cv.getBoundingClientRect();
  const gx = (clientX - r.left) / r.width * GW;
  const gy = (clientY - r.top) / r.height * GH;
  // front-most first
  for (const c of [...crabs].sort((a, b) => b.y - a.y)) {
    if (gx >= c.x && gx <= c.x + CLAWD.width && gy >= c.y - 1 && gy <= c.y + CLAWD.height)
      return c;
  }
  return null;
}

const overlay = document.getElementById('overlay') as HTMLElement;
const iframe = overlay.querySelector('iframe') as HTMLIFrameElement;
const closeBtn = overlay.querySelector('button') as HTMLButtonElement;

function openClip(c: Crab) {
  iframe.src = c.dir + c.name + '.html';
  iframe.title = c.label;
  overlay.hidden = false;
  running = false;
  closeBtn.focus();
}

function closeClip() {
  overlay.hidden = true;
  iframe.src = 'about:blank';
  if (!running) {
    running = true;
    if (!reduced) { last = performance.now(); requestAnimationFrame(frame); }
  }
  cv.focus?.();
}

cv.addEventListener('mousemove', (e) => {
  hovered = crabAt(e.clientX, e.clientY);
  cv.style.cursor = hovered ? 'pointer' : 'default';
  if (reduced) frame(performance.now());
});
cv.addEventListener('mouseleave', () => { hovered = null; });
cv.addEventListener('click', (e) => {
  const c = crabAt(e.clientX, e.clientY);
  if (c) openClip(c);
});
closeBtn.addEventListener('click', closeClip);
overlay.addEventListener('click', (e) => { if (e.target === overlay) closeClip(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !overlay.hidden) closeClip();
});

// ─── DISCOVERY ───────────────────────────────────────────────

async function scenesFrom(path: string): Promise<string[]> {
  try {
    const res = await fetch(path);
    if (!res.ok) return [];
    return (await res.json()).scenes;
  } catch { return []; }
}

const pub = await scenesFrom('manifest.json');
const priv = await scenesFrom('private/manifest.json');
pub.forEach((n, i) => spawnCrab(n, '', i));
priv.forEach((n, i) => spawnCrab(n, 'private/', pub.length + i));

// the accessible fallback: real links, one per animation
const nav = document.getElementById('navlist')!;
for (const c of crabs) {
  const li = document.createElement('li');
  const a = document.createElement('a');
  a.href = c.dir + c.name + '.html';
  a.textContent = c.label.toLowerCase();
  li.appendChild(a);
  nav.appendChild(li);
}

const count = document.getElementById('count');
if (count) count.textContent = crabs.length === 0
  ? 'the tank is empty — run bun serve.ts locally'
  : `${crabs.length} ${crabs.length === 1 ? 'crab' : 'crabs'} in the tank · click one`;

requestAnimationFrame(frame);
