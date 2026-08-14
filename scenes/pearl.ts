// PEARL — Clawd finds a closed shell on the sea floor, taps it, and it opens
// on a pearl. The aquarium's first native scene: same sea, smaller world.
//
// Beats: enter (0-36) → notice (36-52) → approach (52-84) → tap (84-100)
//        → open (100-116) → sparkle and joy (116-168)

import {
  GW, GH, run, px, pxh, pxu, row, mix, rnd, lerp, seg,
  easeOut, easeInOut, drawClawd, bob, burst, type EyeVariant
} from '../engine/engine';

const P = {
  waterTop: '#1a4a54', waterBottom: '#0a2029',
  sandHi: '#c8a86a', sand: '#a8874e', sandLow: '#7a5f33',
  ray: '#9fd8cc', foam: '#c8ece6',
  shell: '#e8d8c2', ridge: '#b99878', lip: '#f2ccc1',
  pearl: '#f6f2ea', shine: '#ffffff'
};

const SAND_TOP = 28;
const SHELL_X = 24, SHELL_Y = SAND_TOP - 5;

// closed scallop, 8×5; 2 = ridge
const SHELL_CLOSED = [
  [0,0,1,1,1,1,0,0],
  [0,1,1,1,1,1,1,0],
  [1,1,2,1,1,2,1,1],
  [1,2,1,1,1,1,2,1],
  [1,1,1,1,1,1,1,1]
];
// open scallop, 8×6: the lid stands behind, the pearl sits on the lip.
// 2 = ridge, 3 = lip, 4 = pearl, 5 = pearl shine
const SHELL_OPEN = [
  [0,0,1,1,1,1,0,0],
  [0,1,2,1,1,2,1,0],
  [1,1,1,1,1,1,1,1],
  [0,3,3,5,4,3,3,0],
  [0,1,1,4,4,1,1,0],
  [1,1,1,1,1,1,1,1]
];
const OPEN_AT = 108;      // the swap frame; the burst covers the cut

function drawWater(f: number) {
  for (let gy = 0; gy < SAND_TOP; gy++)
    row(gy, mix(P.waterTop, P.waterBottom, gy / (SAND_TOP - 1)));
  // two light rays drifting a little
  for (const r of [9, 27]) {
    const drift = Math.sin(f * 0.02 + r) * 1.5;
    for (let gy = 1; gy < SAND_TOP; gy++) {
      const gx = Math.round(r + drift + gy * 0.3);
      const a = 0.08 * (1 - gy / SAND_TOP);
      px(gx, gy, P.ray, a);
      px(gx + 1, gy, P.ray, a * 0.6);
    }
  }
  // slow bubbles rising off the sand, stateless
  for (let k = 0; k < 5; k++) {
    const col = 3 + rnd(k * 7 + 2) * 30;
    const gy = SAND_TOP - 1 - ((f * (0.10 + rnd(k) * 0.08) + rnd(k * 13) * 24) % 24);
    pxh(col * 2, gy * 2, P.foam, 0.4 * Math.min(1, gy / 4));
  }
}

function drawSand() {
  for (let gy = SAND_TOP; gy < GH; gy++) {
    const col = mix(P.sandHi, P.sand, (gy - SAND_TOP) / (GH - SAND_TOP));
    for (let gx = 0; gx < GW; gx++) {
      if (gy === SAND_TOP && rnd(gx * 7 + 1) > 0.6) continue;   // ragged edge
      px(gx, gy, col);
    }
  }
  for (let i = 0; i < 40; i++) {
    const gx = Math.floor(rnd(i * 5 + 2) * GW);
    const gy = SAND_TOP + 1 + Math.floor(rnd(i * 3 + 7) * (GH - SAND_TOP - 1));
    px(gx, gy, rnd(i) > 0.5 ? P.sandLow : P.sandHi, 0.6);
  }
}

function drawShell(f: number) {
  // wobbles while Clawd taps it, then swaps to the open state in one cut
  const x = SHELL_X + (f >= 88 && f < OPEN_AT ? Math.round(Math.sin(f * 1.3)) : 0);

  if (f < OPEN_AT) {
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 8; c++) {
        const v = SHELL_CLOSED[r][c];
        if (v) px(x + c, SHELL_Y + r, v === 2 ? P.ridge : P.shell);
      }
    return;
  }

  const pearlA = seg(f, OPEN_AT, OPEN_AT + 10);
  const y0 = SAND_TOP - 6;
  for (let r = 0; r < 6; r++)
    for (let c = 0; c < 8; c++) {
      const v = SHELL_OPEN[r][c];
      if (!v) continue;
      if (v === 4 || v === 5) {
        px(x + c, y0 + r, P.lip);                       // lip until the pearl fades up
        px(x + c, y0 + r, v === 5 ? P.shine : P.pearl, pearlA);
      } else {
        px(x + c, y0 + r, v === 2 ? P.ridge : v === 3 ? P.lip : P.shell);
      }
    }
}

// a four-point glint over the pearl, pulsing twice after the reveal
function drawGlint(f: number) {
  for (const at of [122, 150]) {
    const a = seg(f, at, at + 6) * (1 - seg(f, at + 8, at + 16));
    if (a <= 0.02) continue;
    // just above the pearl's shine pixel
    const cx = (SHELL_X + 4) * 30, cy = (SAND_TOP - 3.5) * 30;
    for (let i = -2; i <= 2; i++) {
      pxu(8, Math.round(cx / 8) + i, Math.round(cy / 8), P.shine, a * 0.9);
      if (i !== 0) pxu(8, Math.round(cx / 8), Math.round(cy / 8) + i, P.shine, a * 0.9);
    }
  }
}

run({
  name: 'pearl',
  frames: 168,
  background: '#0d1a20',
  render(f) {
    drawWater(f);
    drawSand();
    drawShell(f);

    // Clawd: in from the left, spot, cross, tap, celebrate.
    // He stops short of the shell so it (and the pearl) stay in view.
    const enter = seg(f, 0, 36, easeOut);
    const approach = seg(f, 52, 84, easeInOut);
    let cx = Math.round(lerp(lerp(-15, 4, enter), 9, approach));
    if (f >= 86 && f < 98) cx += 1;                    // the tap lean

    const notice = f >= 40 && f < 48 ? Math.round(Math.sin((f - 40) / 8 * Math.PI) * 1.5) : 0;
    const joy = f >= 120 && f < 152 ? Math.round(Math.max(0, Math.sin((f - 120) * 0.45)) * 2) : 0;
    const moving = f < 36 || (f >= 52 && f < 84);
    const cy = 20 + (moving ? bob(f) : 0) - notice - joy;

    let eyes: EyeVariant = f < 36 ? 'forward' : 'look_right';
    if (f >= 158) eyes = 'forward';                    // done: face the room
    if (f % 80 >= 76) eyes = 'blink';
    drawClawd(cx, cy, { eyes });

    if (f >= OPEN_AT) burst(f, OPEN_AT, 8, SHELL_X + 4, SHELL_Y, P.shine, 33, 24);
    drawGlint(f);
  }
});
