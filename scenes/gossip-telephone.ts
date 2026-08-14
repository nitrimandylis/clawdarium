// LOOSE THREADS clip 2 — TELEPHONE.
// Three crabs down a diagonal. The icon in the bubble is not the icon that
// reaches the wall. No words are involved, which is the joke.

import { run, lerp, seg, easeOut, easeInOut, drawClawd, burst, CLAWD, type EyeVariant } from '../engine/engine';
import { PALETTE, drawWall, drawLamp, drawNote, drawIconBubble, drawTextBubble, drawStamp, stampIn } from './gossip/common';

const CHAIN = [
  { x: 1,  y: 4,  body: CLAWD.body },
  { x: 11, y: 14, body: PALETTE.teal },
  { x: 21, y: 24, body: PALETTE.mustard }
];

// hop legs: 0 → 1, 1 → 2, 2 → wall. Each is travel then mutate.
const HOPS = [
  { from: { x: 5,  y: -1 }, to: { x: 15, y: 9 },  go: 26,  land: 56,  icon: 'eye',   next: 'heart' },
  { from: { x: 15, y: 9 },  to: { x: 25, y: 19 }, go: 64,  land: 94,  icon: 'heart', next: 'fire'  },
  { from: { x: 25, y: 19 }, to: { x: 29, y: 13 }, go: 102, land: 128, icon: 'fire',  next: 'skull' }
];

run({
  name: 'gossip-telephone',
  frames: 192,
  background: '#0d0805',
  render(f) {
    drawWall();
    drawNote(29, 1, 6, 4, { stock: 4, seed: 3, pin: true });

    for (let i = 0; i < CHAIN.length; i++) {
      const c = CHAIN[i];
      // each crab leans toward whoever it is talking to while its hop is live
      const h = HOPS[i];
      const talking = f >= h.go - 8 && f < h.land;
      const listening = i > 0 && f >= HOPS[i - 1].go && f < HOPS[i - 1].land + 10;
      let eyes: EyeVariant = 'forward';
      if (talking) eyes = 'look_right';
      else if (listening) eyes = 'look_left';
      if (i === 0 && f >= 150) eyes = 'look_down';
      if ((f + i * 27) % 90 >= 86) eyes = 'blink';
      const lean = talking ? 1 : 0;
      drawClawd(c.x + lean, c.y, { eyes, body: c.body });
    }

    // the note the last crab pins goes UP onto the wall, clear of the crab
    if (f >= 124) drawNote(29, 19, 6, 4, { stock: 3, seed: 8, pin: f >= 128 });
    if (f >= 128) burst(f, 128, 6, 32, 19, PALETTE.redLit, 17);

    // one bubble in flight at a time
    for (const h of HOPS) {
      if (f < h.go - 6 || f > h.land + 20) continue;
      const appear = seg(f, h.go - 6, h.go, easeOut);
      const fly = seg(f, h.go, h.land, easeInOut);
      const gone = seg(f, h.land + 14, h.land + 20);
      const a = appear * (1 - gone);
      const bx = lerp(h.from.x, h.to.x, fly);
      const by = lerp(h.from.y, h.to.y, fly);
      // it mutates on arrival, not in transit: the distortion happens at the ear
      const mutated = f >= h.land;
      const pop = mutated ? (1 - seg(f, h.land, h.land + 7)) : 0;
      drawIconBubble(Math.round(bx), Math.round(by), mutated ? h.next : h.icon, a, pop);
    }

    // Clawd, at the top, watching what came back out the other end.
    // Placed clear of his head: the bubble's tail was landing on his left eye.
    if (f >= 150 && f < 182) drawTextBubble(16, 1, '?', seg(f, 150, 156) * (1 - seg(f, 176, 182)));

    drawLamp();
    drawStamp(stampIn(f));
  }
});
