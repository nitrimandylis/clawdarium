// The clawdarium engine.
//
// Every animation is a scene: a name, a frame count, and a render(f) function
// that draws frame f from nothing. render(f) must be a pure function of f —
// no Math.random, no Date, no state carried between frames — because the
// capture script (render.ts) pulls frames out of order and the result has to
// be identical every time. Use rnd(seed) wherever randomness is needed.

export const PX = 30;               // one grid cell, in canvas pixels
export const SIZE = 1080;           // canvas is square
export const GW = SIZE / PX;        // 36 cells wide
export const GH = SIZE / PX;        // 36 cells tall
export const HP = PX / 2;           // half cell, for small props
export const FPS = 24;

export interface Scene {
  name: string;
  frames: number;
  loops?: number;                   // times the mp4 repeats the cycle (default 1)
  background?: string;              // page colour behind the canvas
  render: (f: number) => void;
}

let ctx: CanvasRenderingContext2D;

// ─── DRAWING ─────────────────────────────────────────────────
// Everything on screen goes through these. They only ever draw axis-aligned
// squares at integer canvas coordinates, so nothing is anti-aliased.

// one full grid cell
export function px(gx: number, gy: number, col: string, a?: number) {
  if (gx < -2 || gy < -2 || gx > GW + 2 || gy > GH + 2) return;
  if (a !== undefined) {
    if (a <= 0.02) return;
    ctx.globalAlpha = Math.min(1, a);
  }
  ctx.fillStyle = col;
  ctx.fillRect(Math.round(gx) * PX, Math.round(gy) * PX, PX, PX);
  if (a !== undefined) ctx.globalAlpha = 1;
}

// one half-grid cell (72×72 of them)
export function pxh(hx: number, hy: number, col: string, a?: number) {
  if (a !== undefined) {
    if (a <= 0.02) return;
    ctx.globalAlpha = Math.min(1, a);
  }
  ctx.fillStyle = col;
  ctx.fillRect(Math.round(hx) * HP, Math.round(hy) * HP, HP, HP);
  if (a !== undefined) ctx.globalAlpha = 1;
}

// one square of side `unit` canvas pixels, at unit coordinates.
// For sprites that need to be smaller than the half grid (text, stars).
export function pxu(unit: number, ux: number, uy: number, col: string, a?: number) {
  if (a !== undefined) {
    if (a <= 0.02) return;
    ctx.globalAlpha = Math.min(1, a);
  }
  ctx.fillStyle = col;
  ctx.fillRect(Math.round(ux * unit), Math.round(uy * unit), unit, unit);
  if (a !== undefined) ctx.globalAlpha = 1;
}

// fill a full-width band of grid rows in one call (skies, gradients)
export function row(gy: number, col: string) {
  ctx.fillStyle = col;
  ctx.fillRect(0, gy * PX, SIZE, PX);
}

// ─── DETERMINISM & MATH ──────────────────────────────────────

// hash a seed to a stable 0..1 value; the engine's only "random"
export function rnd(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
export function clamp(v: number, a: number, b: number) { return v < a ? a : v > b ? b : v; }
export function easeOut(t: number)   { return 1 - Math.pow(1 - t, 3); }
export function easeIn(t: number)    { return t * t * t; }
export function easeInOut(t: number) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

// 0 before frame a, 1 after frame b, eased in between — the timing workhorse
export function seg(f: number, a: number, b: number, ease?: (t: number) => number) {
  const t = clamp((f - a) / (b - a), 0, 1);
  return ease ? ease(t) : t;
}

// blend two '#rrggbb' colours
export function mix(hexA: string, hexB: string, t: number): string {
  const pa = parseInt(hexA.slice(1), 16);
  const pb = parseInt(hexB.slice(1), 16);
  const r = Math.round(lerp((pa >> 16) & 255, (pb >> 16) & 255, t));
  const g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
  const b = Math.round(lerp(pa & 255, pb & 255, t));
  return `rgb(${r},${g},${b})`;
}

// ─── CLAWD ───────────────────────────────────────────────────
// 14×8, flat, single body colour, 1×1 black eyes, no mouth. This sprite is
// the canonical Clawd; scenes recolour the body but never reshape it.

export const CLAWD = {
  width: 14, height: 8,
  body: '#CD6E58', eye: '#000000',
  data: [
    [0,0,0,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,0,0,0],
    [0,1,1,1,1,1,1,1,1,1,1,1,1,0],
    [0,1,1,1,1,1,1,1,1,1,1,1,1,0],
    [0,0,0,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,0,1,0,1,0,0,1,0,1,0,0,0],
    [0,0,0,1,0,1,0,0,1,0,1,0,0,0]
  ],
  eyeLeft: { x: 4, y: 1 }, eyeRight: { x: 9, y: 1 }
};

export type EyeVariant = 'forward' | 'look_right' | 'look_left' | 'look_up' | 'look_down' | 'blink';

const EYE_OFFSET: Record<Exclude<EyeVariant, 'blink'>, { dx: number, dy: number }> = {
  forward:    { dx: 0,  dy: 0 },
  look_right: { dx: 1,  dy: 0 },
  look_left:  { dx: -1, dy: 0 },
  look_up:    { dx: 0,  dy: -1 },
  look_down:  { dx: 0,  dy: 1 }
};

export interface ClawdOpts {
  eyes?: EyeVariant;
  body?: string;
  alpha?: number;
  eyeCoverL?: boolean;   // hide the left eye (something is sitting on it)
}

export function drawClawd(ox: number, oy: number, opts: ClawdOpts = {}) {
  const body = opts.body || CLAWD.body;
  const a = opts.alpha;
  for (let r = 0; r < CLAWD.height; r++)
    for (let c = 0; c < CLAWD.width; c++)
      if (CLAWD.data[r][c]) px(ox + c, oy + r, body, a);

  const eyes = opts.eyes || 'forward';
  if (eyes === 'blink') return;
  const o = EYE_OFFSET[eyes];
  if (!opts.eyeCoverL) px(ox + CLAWD.eyeLeft.x + o.dx, oy + CLAWD.eyeLeft.y + o.dy, CLAWD.eye, a);
  px(ox + CLAWD.eyeRight.x + o.dx, oy + CLAWD.eyeRight.y + o.dy, CLAWD.eye, a);
}

// a walk cycle worth 1px of bob, so movement never reads as a slide
export function bob(f: number, speed = 0.45) {
  return Math.sin(f * speed) > 0.4 ? -1 : 0;
}

// ─── PARTICLES ───────────────────────────────────────────────
// Stateless: a burst is a pure function of the current frame, so seeking to
// frame 140 gives the same picture as playing up to it.

export function burst(f: number, at: number, n: number, x: number, y: number,
                      col: string, seed: number, life = 26) {
  const age = f - at;
  if (age < 0 || age > life) return;
  for (let i = 0; i < n; i++) {
    const vx = (rnd(seed + i) - 0.5) * 0.55;
    const vy = -rnd(seed + i * 2 + 99) * 0.5 - 0.16;
    px(x + vx * age, y + vy * age + 0.011 * age * age, col, 1 - age / life);
  }
}

// ─── PIXEL FONT ──────────────────────────────────────────────
// 5 wide, 9 tall. Caps sit in rows 0–6, x-height letters in rows 2–6,
// descenders reach rows 7–8. Only the glyphs the scenes need — add rows
// here when a new scene needs a new letter.

const GLYPHS: Record<string, string[]> = {
  A: ['01110','10001','10001','11111','10001','10001','10001','00000','00000'],
  B: ['11110','10001','10001','11110','10001','10001','11110','00000','00000'],
  C: ['01110','10001','10000','10000','10000','10001','01110','00000','00000'],
  D: ['11110','10001','10001','10001','10001','10001','11110','00000','00000'],
  E: ['11111','10000','10000','11110','10000','10000','11111','00000','00000'],
  F: ['11111','10000','10000','11110','10000','10000','10000','00000','00000'],
  G: ['01110','10001','10000','10111','10001','10001','01110','00000','00000'],
  H: ['10001','10001','10001','11111','10001','10001','10001','00000','00000'],
  I: ['01110','00100','00100','00100','00100','00100','01110','00000','00000'],
  L: ['10000','10000','10000','10000','10000','10000','11111','00000','00000'],
  M: ['10001','11011','10101','10101','10001','10001','10001','00000','00000'],
  N: ['10001','11001','10101','10011','10001','10001','10001','00000','00000'],
  O: ['01110','10001','10001','10001','10001','10001','01110','00000','00000'],
  P: ['11110','10001','10001','11110','10000','10000','10000','00000','00000'],
  R: ['11110','10001','10001','11110','10100','10010','10001','00000','00000'],
  S: ['01111','10000','10000','01110','00001','00001','11110','00000','00000'],
  T: ['11111','00100','00100','00100','00100','00100','00100','00000','00000'],
  U: ['10001','10001','10001','10001','10001','10001','01110','00000','00000'],
  V: ['10001','10001','10001','10001','10001','01010','00100','00000','00000'],
  W: ['10001','10001','10001','10101','10101','10101','01010','00000','00000'],
  Y: ['10001','10001','01010','00100','00100','00100','00100','00000','00000'],
  e: ['00000','00000','01110','10001','11111','10000','01110','00000','00000'],
  f: ['00110','01000','11110','01000','01000','01000','01000','00000','00000'],
  i: ['00100','00000','00100','00100','00100','00100','00100','00000','00000'],
  l: ['01100','00100','00100','00100','00100','00100','01110','00000','00000'],
  m: ['00000','00000','11111','10101','10101','10101','10101','00000','00000'],
  n: ['00000','00000','10110','11001','10001','10001','10001','00000','00000'],
  o: ['00000','00000','01110','10001','10001','10001','01110','00000','00000'],
  s: ['00000','00000','01111','10000','01110','00001','11110','00000','00000'],
  y: ['00000','00000','10001','10001','10001','01111','00001','00001','11110'],
  '!': ['00100','00100','00100','00100','00100','00000','00100','00000','00000'],
  '?': ['01110','10001','00001','00110','00100','00000','00100','00000','00000'],
  '.': ['00000','00000','00000','00000','00000','00000','00100','00000','00000'],
  '-': ['00000','00000','00000','01110','00000','00000','00000','00000','00000'],
  '·': ['00000','00000','00000','00100','00000','00000','00000','00000','00000']
};

export const GLYPH_W = 5, GLYPH_H = 9, TRACK = 6;   // 5 wide + 1 blank column

export function textWidth(text: string, unit: number) {
  return (text.length * TRACK - 1) * unit;
}

// draw text centred on centerX, top edge at topY (both in canvas pixels).
// unit = size of one font pixel. Unknown characters advance like a space.
export function drawText(text: string, unit: number, centerX: number, topY: number,
                         col: string, alpha = 1) {
  if (alpha <= 0.02) return;
  const x0 = Math.round(centerX - textWidth(text, unit) / 2);
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.fillStyle = col;
  for (let i = 0; i < text.length; i++) {
    const g = GLYPHS[text[i]];
    if (!g) continue;
    for (let r = 0; r < GLYPH_H; r++)
      for (let c = 0; c < GLYPH_W; c++)
        if (g[r][c] === '1')
          ctx.fillRect(x0 + (i * TRACK + c) * unit, Math.round(topY) + r * unit, unit, unit);
  }
  ctx.globalAlpha = 1;
}

// ─── RUNNING A SCENE ─────────────────────────────────────────
// run() wires a scene to the page: live requestAnimationFrame preview in a
// browser, or the deterministic __renderFrame(f) contract when render.ts
// sets window.__capture before load.

declare global {
  interface Window {
    __capture?: boolean;
    __renderFrame?: (f: number) => void;
    __TOTAL?: number;
    __FPS?: number;
    __NAME?: string;
    __LOOPS?: number;
  }
}

// scenes that need the context directly (the tank hub) call this themselves
export function initCanvas(cv: HTMLCanvasElement) {
  ctx = cv.getContext('2d')!;
  return ctx;
}

export function run(scene: Scene) {
  const cv = document.getElementById('c') as HTMLCanvasElement;
  initCanvas(cv);

  window.__renderFrame = (f: number) => { ctx.globalAlpha = 1; scene.render(f); };
  window.__TOTAL = scene.frames;
  window.__FPS = FPS;
  window.__NAME = scene.name;
  window.__LOOPS = scene.loops || 1;
  document.title = `clawdarium · ${scene.name}`;
  if (scene.background) document.body.style.background = scene.background;

  if (window.__capture) {
    // canvas.screenshot() captures the DISPLAYED size, and the preview CSS
    // scales the canvas to fit the window — pin it so mp4s come out 1080.
    cv.style.width = cv.width + 'px';
    window.__renderFrame(0);
    return;
  }

  const dur = scene.frames / FPS;
  const info = document.getElementById('info');
  let start: number | null = null;
  function loop(ts: number) {
    if (start === null) start = ts;
    const elapsed = (ts - start) / 1000;
    const f = Math.floor((elapsed % dur) * FPS);
    window.__renderFrame!(f);
    if (info) info.textContent = `${scene.name} — ${(f / FPS).toFixed(1)}s / ${dur.toFixed(1)}s`;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}
