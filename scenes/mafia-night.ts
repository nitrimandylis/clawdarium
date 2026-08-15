// MAFIA NIGHT — the LLM-Mafia night phase, played by crabs.
// Four players under one bulb. The light goes down, every pair of eyes shuts,
// and one pair does not. Come morning the table is a crab short, and the one
// who did it is sitting right there looking at you.
//
// Beats: the table (0-34) → lights down (34-56) → one pair stays open (58-88)
//        → the gaze crosses (88-106) → strike (106-118) → dawn, one empty
//        seat (118-148) → the survivor who is still red (148-168)

import {
  GW, GH, run, px, row, mix, lerp, clamp, seg, easeInOut,
  drawClawd, drawText, burst, CLAWD, type EyeVariant
} from '../engine/engine';

// Lifted from ~/.config/swatch/themes/mafia/palette.toml, which was itself
// extracted from the LLM-Mafia viewer's globals.css. `bulb` is the one
// invented colour: the palette has no warm white, and a light pool needs one.
const P = {
  base: '#050609', surface: '#0a0b10', overlay: '#1b1d26',
  muted: '#8b8f9c', accent: '#ff2a2a', deep: '#c41e1e', gold: '#e0a000',
  bulb: '#ffe7ba',
  bodyGold: '#b07c00', bodyBlue: '#4a6a8f'
};

const DIM0 = 34, DIM1 = 56;        // lights down
const SLEEP0 = 30, SLEEP1 = 118;   // every eye shut
const OPEN = 58;                   // except one pair
const GAZE0 = 88, GAZE1 = 106;     // the red crosses the room
const STRIKE = 106;
const DAWN0 = 118, DAWN1 = 142;    // lights back up
const STING = 148;                 // the mafia looks at the camera

const CREW = [
  { x: 2,  y: 5,  body: CLAWD.body },   // 0 — tonight's victim
  { x: 20, y: 6,  body: P.bodyGold },
  { x: 1,  y: 20, body: P.bodyBlue },
  { x: 19, y: 21, body: P.muted }       // 3 — the mafia
];
const VICTIM = 0, MAFIA = 3;

// how lit the room is, 0.05 (night) to 1 (bulb on)
function light(f: number) {
  const down = seg(f, DIM0, DIM1, easeInOut);
  const up = seg(f, DAWN0, DAWN1, easeInOut);
  return clamp(1 - down * 0.95 + up * 0.95, 0.05, 1);
}

// dark room plus the viewer's CRT scanlines
function drawRoom() {
  for (let gy = 0; gy < GH; gy++) row(gy, mix(P.surface, P.base, gy / (GH - 1)));
  for (let gy = 0; gy < GH; gy += 3)
    for (let gx = 0; gx < GW; gx++) px(gx, gy, P.base, 0.35);
}

function drawBulb(lit: number) {
  for (let gy = 0; gy < 3; gy++) px(18, gy, P.overlay);        // cord
  const glass = mix(P.overlay, P.gold, lit);
  for (let gy = 3; gy <= 4; gy++)
    for (let gx = 17; gx <= 18; gx++) px(gx, gy, glass);
}

// one warm pool plus a vignette; the vignette is what swallows the room at
// night, so anything that must stay visible in the dark is drawn after this
function drawLight(lit: number) {
  for (let gy = 0; gy < GH; gy++)
    for (let gx = 0; gx < GW; gx++) {
      const nx = (gx + 0.5 - 18) / 22, ny = (gy + 0.5 - 14) / 20;
      const d = Math.sqrt(nx * nx + ny * ny);
      const halo = Math.max(0, 1 - Math.hypot(gx - 17.5, gy - 4) / 6);
      px(gx, gy, P.bulb, lit * (0.32 * Math.max(0, 1 - d / 0.9) + 0.18 * halo * halo));
      px(gx, gy, P.base, Math.min(0.94, (1 - lit) * 0.9 + clamp(d - 0.45, 0, 1) * 0.5));
    }
}

run({
  name: 'mafia-night',
  frames: 168,
  loops: 3,
  background: '#050609',
  render(f) {
    const lit = light(f);
    drawRoom();
    drawBulb(lit);

    for (let i = 0; i < CREW.length; i++) {
      const c = CREW[i];
      if (i === VICTIM && f >= STRIKE) continue;          // taken in the night

      let eyes: EyeVariant = 'forward';
      if (f < SLEEP0) eyes = i % 2 === 0 ? 'look_right' : 'look_left';
      else if (f < SLEEP1) eyes = 'blink';
      else if (i === 1) eyes = 'look_left';               // all eyes on the gap
      else eyes = 'look_up';
      if (i === MAFIA && f >= STING) eyes = 'forward';    // it looks at you
      if (f < SLEEP0 && (f + i * 17) % 30 >= 27) eyes = 'blink';

      drawClawd(c.x, c.y, { eyes, body: c.body });
    }

    drawLight(lit);

    // the pair that never shut
    const m = CREW[MAFIA];
    if (f >= OPEN && f < STRIKE + 8) {
      const a = seg(f, OPEN, OPEN + 12) * (0.84 + 0.16 * Math.sin(f * 0.3));
      px(m.x + CLAWD.eyeLeft.x, m.y + CLAWD.eyeLeft.y, P.accent, a);
      px(m.x + CLAWD.eyeRight.x, m.y + CLAWD.eyeRight.y, P.accent, a);
    }

    // the gaze crossing the dark, head to head, with a short trail
    const v = CREW[VICTIM];
    if (f >= GAZE0 && f < STRIKE + 4) {
      const t = seg(f, GAZE0, GAZE1, easeInOut);
      for (let k = 0; k < 4; k++) {
        const tk = clamp(t - k * 0.06, 0, 1);
        px(lerp(m.x + 6, v.x + 6, tk), lerp(m.y + 1, v.y + 2, tk),
           k === 0 ? P.accent : P.deep, 0.9 - k * 0.2);
      }
    }

    // the strike: the victim reads red for a beat, then is not there
    if (f >= STRIKE && f < STRIKE + 12)
      drawClawd(v.x, v.y, { body: P.accent, alpha: 1 - seg(f, STRIKE, STRIKE + 12), eyes: 'blink' });
    // two seeds so the scatter spreads instead of clumping into a shape
    burst(f, STRIKE, 6, v.x + 3, v.y + 2, P.deep, 21, 22);
    burst(f, STRIKE, 5, v.x + 12, v.y + 5, P.accent, 47, 22);

    // the empty seat, fading as the room wakes up
    if (f >= DAWN0)
      drawClawd(v.x, v.y, { body: P.muted, alpha: 0.16 * (1 - seg(f, 138, 152)), eyes: 'blink' });

    // and the survivor whose eyes go red anyway
    if (f >= STING) {
      const a = seg(f, STING, STING + 5) * (1 - seg(f, 158, 166));
      px(m.x + CLAWD.eyeLeft.x, m.y + CLAWD.eyeLeft.y, P.accent, a);
      px(m.x + CLAWD.eyeRight.x, m.y + CLAWD.eyeRight.y, P.accent, a);
    }

    drawText('NIGHT', 8, 540, 430, P.muted, seg(f, 36, 46) * (1 - seg(f, 60, 70)) * 0.8);
    drawText('DAY', 8, 540, 430, P.gold, seg(f, 122, 132) * (1 - seg(f, 144, 154)) * 0.8);

    // fade out and in on the same black, so the cut back to a full table
    // reads as the next night rather than a jump
    const fade = Math.max(seg(f, 158, 168), 1 - seg(f, 0, 8));
    if (fade > 0.02)
      for (let gy = 0; gy < GH; gy++)
        for (let gx = 0; gx < GW; gx++) px(gx, gy, P.base, fade);
  }
});
