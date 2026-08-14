// LOOSE THREADS clip 3 — THE BOARD.
// The reveal is built backwards: the wordmark cells are decided first, eight
// of them get a close-up life as full notes, and the pull-back is those eight
// lerping home while the other cells fade up around them.

import {
  SIZE, PX, GH, run, lerp, seg, easeOut, easeIn, easeInOut,
  drawClawd, bob, burst, drawText, type EyeVariant
} from '../engine/engine';
import {
  PALETTE, drawWall, drawLamp, drawNote, drawString, layoutWord
} from './gossip/common';

const WORD_CELLS = layoutWord('LOOSE', 8).concat(layoutWord('THREADS', 15));
// eight heroes spread across both words
const HERO_IDX = [4, 21, 38, 55, 68, 87, 104, 120].map(i => i % WORD_CELLS.length);
const HERO_CLOSE = [
  { gx: 3,  gy: 3 },  { gx: 15, gy: 2 },  { gx: 26, gy: 4 },  { gx: 6,  gy: 12 },
  { gx: 17, gy: 11 }, { gx: 27, gy: 13 }, { gx: 10, gy: 20 }, { gx: 23, gy: 20 }
];
const TIES = [[0,1],[1,4],[4,3],[3,6],[4,7],[1,2],[2,5]];

run({
  name: 'gossip-the-board',
  frames: 192,
  background: '#0d0805',
  render(f) {
    drawWall();

    const pull = seg(f, 106, 152, easeInOut);     // the camera pulling back
    const W = lerp(5, 1, pull), H = lerp(4, 1, pull);

    // where each hero note is right now
    const heroPos = HERO_IDX.map((wi, i) => ({
      x: lerp(HERO_CLOSE[i].gx, WORD_CELLS[wi].gx, pull),
      y: lerp(HERO_CLOSE[i].gy, WORD_CELLS[wi].gy, pull)
    }));

    // strings: four tied on camera, the rest already there
    for (let i = 0; i < TIES.length; i++) {
      const [a, b] = TIES[i];
      const tieAt = 20 + i * 12;
      const prog = i < 4 ? seg(f, tieAt, tieAt + 14, easeOut) : seg(f, 6, 14);
      if (prog <= 0) continue;
      const pa = heroPos[a], pb = heroPos[b];
      // The string is the hero up close and a ghost once the letters exist:
      // at full opacity it cut straight through the wordmark and killed it.
      drawString(pa.x + W / 2, pa.y + 1, pb.x + W / 2, pb.y + 1, prog,
        { sag: lerp(2.2, 0.5, pull), alpha: lerp(1, 0.2, easeOut(pull)), dark: pull > 0.6 });
      if (i < 4) burst(f, tieAt + 14, 5, pb.x + W / 2, pb.y, PALETTE.redLit, 60 + i * 9);
    }

    // the rest of the wall, arriving as the frame widens
    for (let i = 0; i < WORD_CELLS.length; i++) {
      if (HERO_IDX.includes(i)) continue;
      const c = WORD_CELLS[i];
      const at = 112 + (i % 23) * 1.6;
      const a = seg(f, at, at + 16, easeOut) * pull;
      if (a <= 0.02) continue;
      drawNote(c.gx, c.gy, 1, 1, { stock: i % 5, alpha: a });
    }
    heroPos.forEach((p, i) => drawNote(p.x, p.y, Math.round(W), Math.round(H),
      { stock: i % 5, seed: i * 13, pin: pull < 0.55, squiggle: pull < 0.5 }));

    // Clawd works the wall, then steps out of frame before the reveal lands
    const walk = seg(f, 6, 100, easeInOut);
    const exit = seg(f, 104, 132, easeIn);
    const cx = lerp(2, 22, walk);
    const cy = 26 + Math.round(exit * 14) + (f < 100 ? bob(f, 0.4) : 0);
    if (cy < GH + 2) {
      let eyes: EyeVariant = f < 100 ? (f % 24 < 12 ? 'look_up' : 'look_right') : 'look_up';
      if (f % 78 >= 74) eyes = 'blink';
      drawClawd(cx, cy, { eyes });
    }

    // the tagline, now in the engine's own pixel face
    const tag = seg(f, 150, 168, easeOut);
    drawText('ANONYMOUS GOSSIP · CONNECT THE DOTS', 5, SIZE / 2, 22.5 * PX - 22,
      PALETTE.tagline, tag);

    drawLamp();
  }
});
