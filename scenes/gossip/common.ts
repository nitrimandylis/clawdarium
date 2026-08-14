// Shared set for the four loosethreads clips: the cork wall, the lamp, notes,
// red string, bubbles and the LOOSE THREADS stamp. Every brown, red and cream
// is lifted from loosethreads' src/app/globals.css. The two extra crab hues
// are the only invented colours, and they are muted on purpose: that
// stylesheet's rule is "red is the only colour that isn't brown".

import {
  PX, GW, GH, px, rnd, lerp, clamp, seg, easeOut, mix,
  drawText, textWidth, GLYPH_H
} from '../../engine/engine';

export const PALETTE = {
  cork:    '#6f5233', corkHi:  '#8d6b42', corkLow: '#543c22',
  vignette:'#170f07', lamp:    '#ffe7ba',
  red:     '#c0231f', redLit:  '#e24a3f', redDark: '#7d0f0a',
  brass:   '#c9a23a', flame:   '#e8b13a',
  panel:   '#1d160e', panelEdge:'#47372a', ink: '#f2e9da', inkDim: '#b8a684',
  head:    '#efe2c0', headInk: '#241a10', tagline: '#d8c49a',
  squiggle:'#4a3c2c',
  teal:    '#5a7f7a', mustard: '#b08a3e'
};

// the five paper stocks, in the order globals.css defines them
export const STOCKS = ['#f7ec9f', '#e6d4a5', '#e8eae4', '#f2ccc1', '#e7e3d8'];

// ─── THE WALL ────────────────────────────────────────────────
// Cork as a per-cell gradient rather than a smooth one, so the surface stays
// on the pixel grid. Flecks are seeded, never random.
const FLECKS: { gx: number, gy: number, hi: boolean }[] = [];
for (let i = 0; i < 300; i++) {
  FLECKS.push({
    gx: Math.floor(rnd(i * 3 + 1) * GW),
    gy: Math.floor(rnd(i * 3 + 2) * GH),
    hi: rnd(i * 3 + 3) > 0.45
  });
}

export function drawWall() {
  for (let gy = 0; gy < GH; gy++) {
    for (let gx = 0; gx < GW; gx++) {
      const u = (gx / GW) * 0.55 + (gy / GH) * 0.45;
      px(gx, gy, u < 0.48
        ? mix(PALETTE.corkHi, PALETTE.cork, u / 0.48)
        : mix(PALETTE.cork, PALETTE.corkLow, (u - 0.48) / 0.52));
    }
  }
  for (const f of FLECKS) px(f.gx, f.gy, f.hi ? PALETTE.corkHi : PALETTE.corkLow, 0.5);
}

// The desk lamp, drawn last over everything: one warm pool, dark at every
// edge. globals.css puts it at 50% 30% because the wordmark is what needs
// lighting on the site. Here the actor is on the floor, so the pool drops
// to 46% — at 30% Clawd stood in his own shadow for every clip.
export function drawLamp() {
  for (let gy = 0; gy < GH; gy++) {
    for (let gx = 0; gx < GW; gx++) {
      const nx = (gx + 0.5 - GW / 2) / 24;
      const ny = (gy + 0.5 - GH * 0.46) / 22;
      const d = Math.sqrt(nx * nx + ny * ny);
      const warm = 0.17 * Math.max(0, 1 - d / 0.62);
      if (warm > 0.01) px(gx, gy, PALETTE.lamp, warm);
      if (d > 0.55) px(gx, gy, PALETTE.vignette,
        Math.min(0.9, Math.pow((d - 0.55) / 0.55, 1.3) * 0.9));
    }
  }
}

// ─── A NOTE ──────────────────────────────────────────────────
// Squiggles, never words. Nothing on this wall is legible except the
// wordmark itself.
export interface NoteOpts {
  alpha?: number;
  stock?: number;
  seed?: number;
  squiggle?: boolean;
  pin?: boolean | 'brass';
}

export function drawNote(gx: number, gy: number, w: number, h: number, o: NoteOpts = {}) {
  gx = Math.round(gx); gy = Math.round(gy);
  const a = o.alpha;
  const paper = o.stock !== undefined ? STOCKS[o.stock % 5] : STOCKS[0];
  if (w >= 3 && h >= 2) {                       // cast shadow, lifted paper
    for (let y = 0; y < h; y++) px(gx + w, gy + y + 1, PALETTE.vignette, (a === undefined ? 1 : a) * 0.45);
    for (let x = 0; x < w; x++) px(gx + x + 1, gy + h, PALETTE.vignette, (a === undefined ? 1 : a) * 0.45);
  }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      px(gx + x, gy + y, paper, a);

  // Handwriting, at one dash per line with a blank line between. Drawn on
  // every row it read as a redaction bar rather than as writing.
  if (w >= 4 && h >= 3 && o.squiggle !== false) {
    const seed = o.seed === undefined ? gx * 7 + gy : o.seed;
    for (let r = 1; r < h - 1; r += 2) {
      const len = 2 + Math.floor(rnd(seed + r) * (w - 3));
      for (let x = 1; x <= len; x++) px(gx + x, gy + r, PALETTE.squiggle, a);
    }
  }
  if (o.pin) px(gx + Math.floor(w / 2), gy, o.pin === 'brass' ? PALETTE.brass : PALETTE.redLit, a);
}

// ─── RED STRING ──────────────────────────────────────────────
// A dropped shadow cell and the yarn. It sags, and draws on via `prog`.
export function drawString(x1: number, y1: number, x2: number, y2: number, prog: number,
                           o: { sag?: number, alpha?: number, dark?: boolean } = {}) {
  if (prog <= 0) return;
  const sag = o.sag === undefined ? 2.2 : o.sag;
  const steps = 90;
  const seen = new Set<string>();
  const end = Math.floor(steps * clamp(prog, 0, 1));
  for (let i = 0; i <= end; i++) {
    const t = i / steps;
    const x = Math.round(lerp(x1, x2, t));
    const y = Math.round(lerp(y1, y2, t) + sag * 4 * t * (1 - t));
    const k = x + ',' + y;
    if (seen.has(k)) continue;
    seen.add(k);
    px(x, y + 1, PALETTE.vignette, (o.alpha === undefined ? 1 : o.alpha) * 0.4);
    px(x, y, o.dark ? PALETTE.redDark : PALETTE.red, o.alpha);
  }
}

// ─── BUBBLES ─────────────────────────────────────────────────
export function bubbleBox(bx: number, by: number, w: number, h: number, a?: number) {
  for (let y = -1; y <= h; y++)
    for (let x = -1; x <= w; x++) {
      const edge = (y === -1 || y === h || x === -1 || x === w);
      if (edge && ((y === -1 || y === h) && (x === -1 || x === w))) continue;
      px(bx + x, by + y, edge ? PALETTE.panelEdge : PALETTE.panel, a);
    }
  px(bx, by + h + 1, PALETTE.panelEdge, a);   // tail
}

// 5×5 icons drawn inside a dark bubble. 1 = primary, 2 = secondary.
export const ICONS: Record<string, { p: string, s: string, d: number[][] }> = {
  eye:   { p: PALETTE.ink, s: PALETTE.ink, d: [
    [0,1,1,1,0],
    [1,0,0,0,1],
    [1,0,2,0,1],
    [1,0,0,0,1],
    [0,1,1,1,0]] },
  heart: { p: PALETTE.red, s: PALETTE.redLit, d: [
    [0,1,0,1,0],
    [1,2,1,2,1],
    [1,1,1,1,1],
    [0,1,1,1,0],
    [0,0,1,0,0]] },
  fire:  { p: PALETTE.red, s: PALETTE.flame, d: [
    [0,0,1,0,0],
    [0,1,1,1,0],
    [1,1,2,1,1],
    [1,2,2,2,1],
    [0,1,1,1,0]] },
  skull: { p: PALETTE.ink, s: PALETTE.ink, d: [
    [0,1,1,1,0],
    [1,1,1,1,1],
    [1,0,1,0,1],
    [0,1,1,1,0],
    [0,1,0,1,0]] }
};

export function drawIconBubble(bx: number, by: number, icon: string, a: number, pop: number) {
  bubbleBox(bx, by, 5, 5, a);
  const ic = ICONS[icon];
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 5; c++) {
      const v = ic.d[r][c];
      if (v) px(bx + c, by + r, v === 2 ? ic.s : ic.p, a);
    }
  if (pop > 0) {                                // a ring flash on mutation
    for (let i = -2; i <= 6; i++) {
      px(bx + i, by - 2, PALETTE.ink, pop * 0.7); px(bx + i, by + 6, PALETTE.ink, pop * 0.7);
      px(bx - 2, by + i, PALETTE.ink, pop * 0.7); px(bx + 6, by + i, PALETTE.ink, pop * 0.7);
    }
  }
}

// short exclamations ('!!', '?', '...') in the engine's pixel font
export function drawTextBubble(bx: number, by: number, text: string, a?: number) {
  const w = Math.max(2, text.length + 1);
  bubbleBox(bx, by, w, 3, a);
  const unit = clamp(Math.floor((w * PX - 16) / (text.length * 6 - 1)), 4, 9);
  const topY = by * PX + (3 * PX - GLYPH_H * unit) / 2;
  drawText(text, unit, (bx + w / 2) * PX, topY, PALETTE.ink, a === undefined ? 1 : a);
}

// ─── THE STAMP ───────────────────────────────────────────────
// Each clip is posted on its own, so each one signs itself. A taped card,
// not an overlay, so it stays part of the wall.
export function drawStamp(a: number) {
  if (a <= 0.02) return;
  const gx = 10, gy = 30, w = 16, h = 5;
  for (let y = 0; y < h; y++) px(gx + w, gy + y + 1, PALETTE.vignette, a * 0.5);
  for (let x = 0; x < w; x++) px(gx + x + 1, gy + h, PALETTE.vignette, a * 0.5);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) px(gx + x, gy + y, PALETTE.head, a);
  for (let x = 0; x < 3; x++) {                 // tape at both corners
    px(gx - 1 + x, gy - 1, PALETTE.inkDim, a * 0.55);
    px(gx + w - 2 + x, gy - 1, PALETTE.inkDim, a * 0.55);
  }
  const unit = 6;   // 'LOOSE THREADS' at unit 6 is 462px on a 480px card
  const topY = gy * PX + (h * PX - GLYPH_H * unit) / 2;
  drawText('LOOSE THREADS', unit, (gx + w / 2) * PX, topY, PALETTE.headInk, a);
}

// set dressing: notes that were already on the wall before the clip began
const DRESSING = [
  { gx: 2,  gy: 3,  w: 6, h: 4, s: 1 }, { gx: 27, gy: 2,  w: 7, h: 5, s: 3 },
  { gx: 12, gy: 1,  w: 5, h: 4, s: 4 }, { gx: 31, gy: 12, w: 4, h: 3, s: 0 }
];
export function drawDressing() {
  for (const d of DRESSING) drawNote(d.gx, d.gy, d.w, d.h, { stock: d.s, pin: true, seed: d.gx });
}

// ─── 3×5 WORDMARK FONT ───────────────────────────────────────
// Only the letters LOOSE THREADS needs. This is scene data, not the engine
// font: each lit cell becomes one 1×1 note in the reveal, and at 3×5 the
// word THREADS is the widest thing that still fits the 36-cell wall.
const WORDMARK_FONT: Record<string, string[]> = {
  L:['100','100','100','100','111'], O:['111','101','101','101','111'],
  S:['111','100','111','001','111'], E:['111','100','111','100','111'],
  T:['111','010','010','010','010'], H:['101','101','111','101','101'],
  R:['111','101','111','110','101'], A:['111','101','111','101','101'],
  D:['110','101','101','101','110']
};

// one grid cell per lit pixel; each cell becomes one 1×1 note
export function layoutWord(word: string, gy: number) {
  const w = word.length * 4 - 1;
  const gx0 = Math.floor((GW - w) / 2);
  const cells: { gx: number, gy: number }[] = [];
  for (let i = 0; i < word.length; i++)
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 3; c++)
        if (WORDMARK_FONT[word[i]][r][c] === '1')
          cells.push({ gx: gx0 + i * 4 + c, gy: gy + r });
  return cells;
}

export const stampIn = (f: number) => seg(f, 176, 186, easeOut);
