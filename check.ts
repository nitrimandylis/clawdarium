// The engine's one check: render(f) must be a pure function of f.
//
//   bun check.ts        (build first: bun build.ts)
//
// Math asserts run instantly; then every built scene renders frame 60,
// renders other frames, and renders frame 60 again. The two captures must be
// byte-identical, which is exactly what breaks if a scene sneaks in
// Math.random, Date, or state carried between frames.

import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import assert from 'node:assert';
import { $ } from 'bun';
import { rnd, seg, mix, easeOut, textWidth } from './engine/engine';

assert(rnd(42) === rnd(42), 'rnd must be stable for a seed');
assert(rnd(1) !== rnd(2), 'rnd must vary by seed');
assert(seg(0, 10, 20) === 0 && seg(30, 10, 20) === 1, 'seg clamps');
assert(seg(15, 10, 20) === 0.5, 'seg interpolates');
assert(easeOut(0) === 0 && easeOut(1) === 1, 'easings hit their endpoints');
assert(mix('#000000', '#ffffff', 0.5) === 'rgb(128,128,128)', 'mix blends');
assert(textWidth('AB', 10) === 110, 'textWidth: 2 glyphs, 1 gap, unit 10');

const DIR = import.meta.dir;
const SHELL = (await $`ls -d ${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-mac-arm64/chrome-headless-shell`.text()).trim();

async function manifest(dir: string): Promise<string[]> {
  const path = `${dir}/manifest.json`;
  if (!existsSync(path)) return [];
  return (await Bun.file(path).json()).scenes;
}

const targets: { name: string, dir: string }[] = [];
for (const name of await manifest(`${DIR}/docs`)) targets.push({ name, dir: `${DIR}/docs` });
for (const name of await manifest(`${DIR}/docs/private`)) targets.push({ name, dir: `${DIR}/docs/private` });
if (targets.length === 0) throw new Error('no built scenes — run bun build.ts first');

const browser = await chromium.launch({ executablePath: SHELL });
let failed = false;

for (const t of targets) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1080 } });
  await page.addInitScript(() => { (window as any).__capture = true; });
  await page.goto(`file://${t.dir}/${t.name}.html`);
  await page.waitForFunction(() => (window as any).__renderFrame !== undefined);
  const canvas = page.locator('#c');

  const shot = async (f: number) => {
    await page.evaluate((n) => (window as any).__renderFrame(n), f);
    return Bun.hash(await canvas.screenshot());
  };

  const first = await shot(60);
  await shot(5);
  await shot(100);
  const second = await shot(60);
  await page.close();

  if (first === second) {
    console.log(`ok   ${t.name}`);
  } else {
    console.error(`FAIL ${t.name}: frame 60 depends on render order`);
    failed = true;
  }
}

await browser.close();
if (failed) process.exit(1);
console.log('every scene is deterministic');
