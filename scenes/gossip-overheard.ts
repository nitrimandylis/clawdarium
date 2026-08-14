// LOOSE THREADS clip 1 — OVERHEARD.
// A note drifts past, Clawd clocks it, and puts it on the wall.

import { run, px, lerp, seg, easeOut, easeInOut, drawClawd, bob, burst, type EyeVariant } from '../engine/engine';
import { PALETTE, drawWall, drawLamp, drawNote, drawTextBubble, drawStamp, drawDressing, stampIn } from './gossip/common';

run({
  name: 'gossip-overheard',
  frames: 192,
  background: '#0d0805',
  render(f) {
    drawWall();
    drawDressing();

    // the note's flight: in from the right, wobbling down to the floor
    const flyIn = seg(f, 24, 68, easeOut);
    const noteX = lerp(38, 21, flyIn);
    const noteY = lerp(2, 25, flyIn) + (flyIn < 1 ? Math.sin(f * 0.34) * 1.6 : 0);

    // Clawd: enters, spots it, crosses to it, carries it up, steps back
    const enter = seg(f, 0, 26, easeOut);
    const cross = seg(f, 74, 108, easeInOut);
    const back  = seg(f, 150, 168, easeOut);
    let cx = lerp(-14, 6, enter);
    cx = lerp(cx, 17, cross);
    cx = lerp(cx, 13, back);
    const moving = (f < 26) || (f >= 74 && f < 108) || (f >= 150 && f < 168);
    const joy = f >= 168 ? Math.sin((f - 168) * 0.5) : 0;
    const cy = 21 + (moving ? bob(f) : 0) - (f >= 168 ? Math.round(Math.max(0, joy) * 1.6) : 0);

    let eyes: EyeVariant = 'forward';
    if (f >= 26 && f < 108) eyes = 'look_right';
    else if (f >= 108) eyes = 'look_up';
    if (f % 84 >= 80) eyes = 'blink';

    // where the note actually is, frame by frame
    const lift  = seg(f, 110, 126, easeOut);      // picked up off the floor
    const raise = seg(f, 128, 156, easeInOut);    // carried onto the wall
    let nx = noteX, ny = noteY;
    if (f >= 110) {
      nx = lerp(noteX, cx + 5, lift);
      ny = lerp(25, 18, lift);
      nx = lerp(nx, 19, raise);
      ny = lerp(ny, 9, raise);
    }
    drawNote(nx, ny, 5, 4, { stock: 2, seed: 11, pin: f >= 154 });

    drawClawd(cx, cy, { eyes });

    if (f >= 52 && f < 76) drawTextBubble(cx + 15, cy - 5, '!!', seg(f, 52, 58) * (1 - seg(f, 70, 76)));
    if (f >= 154) burst(f, 154, 7, 21, 9, PALETTE.redLit, 5);
    if (f >= 170) burst(f, 170, 5, cx + 7, cy - 2, PALETTE.redLit, 41, 30);

    drawLamp();
    drawStamp(stampIn(f));
  }
});
