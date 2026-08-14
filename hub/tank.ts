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
  PX, HP as HALF, SIZE, GW, GH, initCanvas, px, pxh, mix, rnd,
  drawText, CLAWD
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

// Crabs live on the HALF grid at half scale (a body is 7×4 full cells), so
// the tank reads as a tank rather than a crab crowd. Each crab keeps a home
// territory it wanders around, which spreads them across the sand.
interface Crab {
  name: string;
  label: string;
  dir: string;            // '' for public scenes, 'private/' for local ones
  x: number;              // half-grid col, left edge of the body
  y: number;              // half-grid row, fixed depth lane
  home: number;
  target: number;
  speed: number;          // half cells per second
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
// depth lanes in half rows; feet land on the sand slope (rows 27/30/32)
const LANES = [46, 52, 56];
const X_MIN = (INNER_L + 1) * 2, X_MAX = INNER_R * 2 - CLAWD.width - 2;
const TERRITORY = 9;      // how far a crab wanders from home, in half cells
const SEP = 12;           // min gap between crab left-edges before they repel

function spawnCrab(name: string, dir: string, i: number, total: number) {
  // homes are spread evenly across the sand so the tank never bunches up
  const home = X_MIN + (i + 0.5) * (X_MAX - X_MIN) / total
    + (rnd(i * 31 + 5) - 0.5) * 4;
  crabs.push({
    name, dir,
    label: name.replace(/^gossip-/, '').replace(/-/g, ' ').toUpperCase(),
    x: home, y: LANES[i % LANES.length],
    home, target: home,
    speed: 4 + rnd(i * 17) * 2.5,
    restUntil: rnd(i * 7) * 4,
    seed: i * 97 + 13
  });
}

// pick the candidate spot in the territory that keeps the most distance
// from where everyone else is headed
function pickTarget(c: Crab): number {
  let best = c.home, bestGap = -1;
  for (let t = 0; t < 6; t++) {
    const cand = Math.max(X_MIN, Math.min(X_MAX,
      c.home + (Math.random() * 2 - 1) * TERRITORY));
    let gap = Infinity;
    for (const o of crabs) if (o !== c) gap = Math.min(gap, Math.abs(cand - o.target));
    if (gap > bestGap) { bestGap = gap; best = cand; }
  }
  return best;
}

function updateCrab(c: Crab, sec: number, dt: number) {
  if (sec < c.restUntil) return;
  if (Math.abs(c.x - c.target) < 0.4) {
    // arrived: rest a while, then pick a new spot inside the territory
    c.restUntil = sec + 1.5 + Math.random() * 4;
    c.target = pickTarget(c);
    return;
  }
  c.x += Math.sign(c.target - c.x) * c.speed * dt;
}

// crabs that get too close push each other apart, so they pass and jostle
// instead of stacking into one many-eyed blob
function separate(dt: number) {
  for (let i = 0; i < crabs.length; i++)
    for (let j = i + 1; j < crabs.length; j++) {
      const a = crabs[i], b = crabs[j];
      const d = a.x - b.x;
      const gap = Math.abs(d);
      if (gap >= SEP) continue;
      const push = (SEP - gap) * 1.5 * dt;
      const dir = d === 0 ? 1 : Math.sign(d);
      a.x = Math.max(X_MIN, Math.min(X_MAX, a.x + dir * push));
      b.x = Math.max(X_MIN, Math.min(X_MAX, b.x - dir * push));
    }
}

// the clawd sprite at half scale, on the half grid
function drawClawdHalf(hx: number, hy: number, body: string, eyes: string) {
  for (let r = 0; r < CLAWD.height; r++)
    for (let col = 0; col < CLAWD.width; col++)
      if (CLAWD.data[r][col]) pxh(hx + col, hy + r, body);
  if (eyes === 'blink') return;
  const off = eyes === 'look_right' ? { dx: 1, dy: 0 }
    : eyes === 'look_left' ? { dx: -1, dy: 0 }
    : eyes === 'look_up' ? { dx: 0, dy: -1 } : { dx: 0, dy: 0 };
  pxh(hx + CLAWD.eyeLeft.x + off.dx, hy + CLAWD.eyeLeft.y + off.dy, CLAWD.eye);
  pxh(hx + CLAWD.eyeRight.x + off.dx, hy + CLAWD.eyeRight.y + off.dy, CLAWD.eye);
}

function drawCrab(c: Crab, sec: number) {
  const walking = sec >= c.restUntil && Math.abs(c.x - c.target) >= 0.4;
  const step = walking && Math.sin(sec * 9 + c.seed) > 0.3 ? -1 : 0;
  const blink = (sec * 24 + c.seed) % 90 >= 87;
  const eyes = blink ? 'blink'
    : walking ? (c.target > c.x ? 'look_right' : 'look_left')
    : (c === hovered ? 'look_up' : 'forward');
  // back lanes sit deeper in the water: tint them toward it so two
  // overlapping crabs stay two crabs instead of one blob
  const depth = (LANES[LANES.length - 1] - c.y) / (LANES[LANES.length - 1] - LANES[0]);
  const body = depth > 0 ? mix(CLAWD.body, WATER.bottom, depth * 0.30) : CLAWD.body;
  drawClawdHalf(Math.round(c.x), c.y + step, body, eyes);

  // every crab wears its name, so picking the right one never needs a hover
  const cx = (Math.round(c.x) + CLAWD.width / 2) * HALF;
  const topY = (c.y + CLAWD.height + 1.2) * HALF;
  const a = c === hovered ? 1 : 0.55;
  drawText(c.label, 3, cx + 2, topY + 2, WATER.tagShadow, a * 0.8);
  drawText(c.label, 3, cx, topY, WATER.tagInk, a);
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
  separate(dt);
  for (const c of [...crabs].sort((a, b) => a.y - b.y)) drawCrab(c, sec);
  drawBubbles(sec);
  drawTitle();
  drawTankFrame();

  if (running && !reduced) requestAnimationFrame(frame);
}

// ─── INPUT ───────────────────────────────────────────────────

function crabAt(clientX: number, clientY: number): Crab | null {
  const r = cv.getBoundingClientRect();
  const gx = (clientX - r.left) / r.width * GW * 2;    // half-grid coords
  const gy = (clientY - r.top) / r.height * GH * 2;
  // front-most first; the hitbox covers the body and the name label
  for (const c of [...crabs].sort((a, b) => b.y - a.y)) {
    if (gx >= c.x - 1 && gx <= c.x + CLAWD.width + 1
      && gy >= c.y - 2 && gy <= c.y + CLAWD.height + 5)
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
const total = pub.length + priv.length;
pub.forEach((n, i) => spawnCrab(n, '', i, total));
priv.forEach((n, i) => spawnCrab(n, 'private/', pub.length + i, total));

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
