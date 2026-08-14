// LOOSE THREADS clip 4 — COLLAPSE.
// He pulls one string to tidy it up. It is his fault, not the wall's.

import {
  run, lerp, clamp, seg, easeOut, easeIn, easeInOut, rnd,
  drawClawd, bob, burst, type EyeVariant
} from '../engine/engine';
import {
  PALETTE, drawWall, drawLamp, drawNote, drawString, drawTextBubble,
  drawStamp, stampIn
} from './gossip/common';

const WEB = [
  { gx: 3,  gy: 3,  w: 6, h: 4 }, { gx: 15, gy: 2,  w: 5, h: 4 },
  { gx: 26, gy: 4,  w: 6, h: 5 }, { gx: 8,  gy: 11, w: 5, h: 4 },
  { gx: 19, gy: 12, w: 6, h: 4 }, { gx: 28, gy: 14, w: 4, h: 3 },
  { gx: 13, gy: 19, w: 6, h: 4 }
];
const WEB_TIES = [[0,1],[1,2],[0,3],[3,4],[1,4],[4,5],[3,6],[4,6]];
const FLOOR = 29;

run({
  name: 'gossip-collapse',
  frames: 192,
  background: '#0d0805',
  render(f) {
    drawWall();

    const tug  = seg(f, 42, 58, easeIn);          // he hauls on the sag
    const snap = f >= 58;
    const fallT = f - 58;

    // per-note fall: staggered, gravity, landing stacked along the floor
    function noteAt(i: number) {
      const n = WEB[i];
      if (!snap) return { x: n.gx, y: n.gy };
      const t = Math.max(0, fallT - i * 4);
      // jumbled, not shelved: a level row of notes reads as a bookshelf
      const restY = FLOOR - n.h + Math.round(rnd(i * 11 + 4) * 3) - 1;
      const restX = 1 + i * 4.4 + Math.round(rnd(i * 5) * 3);
      const y = Math.min(restY, n.gy + 0.055 * t * t);
      return { x: lerp(n.gx, restX, clamp(t / 26, 0, 1)), y };
    }
    const pos = WEB.map((_, i) => noteAt(i));

    // strings go slack as the tug lands, then drop with whatever they held
    for (let i = 0; i < WEB_TIES.length; i++) {
      const [a, b] = WEB_TIES[i];
      const pa = pos[a], pb = pos[b];
      const fade = snap ? 1 - seg(f, 58 + i * 3, 78 + i * 3) : 1;
      if (fade <= 0.02) continue;
      // the one he is pulling on: its sag straightens as he hauls
      const isPulled = i === 6;
      const sag = isPulled ? lerp(4.2, 1.0, tug) : lerp(2.4, 3.4, tug * 0.5);
      drawString(pa.x + WEB[a].w / 2, pa.y + 1, pb.x + WEB[b].w / 2, pb.y + 1, 1,
        { sag, alpha: fade });
    }

    for (let i = 0; i < WEB.length; i++)
      drawNote(pos[i].x, pos[i].y, WEB[i].w, WEB[i].h,
        { stock: i % 5, seed: i * 7 + 2, pin: !snap });

    // Clawd
    const walk = seg(f, 4, 38, easeInOut);
    const bury = seg(f, 74, 92, easeIn);          // sinks under the pile
    const rise = seg(f, 118, 142, easeOut);       // surfaces again
    const cx = Math.round(lerp(3, 11, walk));
    const cy = Math.round(21 + bury * 6 - rise * 6 + (f < 38 ? bob(f) : 0)
      - (f >= 42 && f < 58 ? Math.round(tug * 1.5) : 0));

    let eyes: EyeVariant = 'forward';
    if (f >= 30 && f < 92) eyes = 'look_up';
    else if (f >= 142) eyes = 'forward';
    if (f % 70 >= 66 && f < 74) eyes = 'blink';
    // the shrug: he shifts weight left, then right, and gives up
    const shrug = f >= 152 ? Math.round(Math.sin((f - 152) * 0.26) * 1.4) : 0;

    drawClawd(cx + shrug, cy, { eyes, eyeCoverL: f >= 118 });
    // one note lands over his eye and stays there
    if (f >= 118) drawNote(cx + shrug + 2, cy - 1, 4, 3, { stock: 0, seed: 91, alpha: rise });

    if (f >= 58) burst(f, 58, 9, 16, 20, PALETTE.redLit, 23);
    if (f >= 92) burst(f, 92, 8, 14, 27, PALETTE.corkLow, 77, 32);
    if (f >= 158 && f < 182) drawTextBubble(cx + shrug + 15, cy - 4, '...',
      seg(f, 158, 164) * (1 - seg(f, 176, 182)));

    drawLamp();
    drawStamp(stampIn(f));
  }
});
