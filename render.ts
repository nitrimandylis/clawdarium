// Capture built scenes to 24fps MP4s next to their HTML in docs/.
//
//   bun render.ts             every scene in both manifests
//   bun render.ts dione       just one scene
//
// Frames are pulled one at a time via window.__renderFrame(f), so the output
// is deterministic — nothing depends on when requestAnimationFrame fired.
// Needs the playwright headless shell already in ~/Library/Caches.

import { chromium } from 'playwright-core';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { $ } from 'bun';

const DIR = import.meta.dir;
const SHELL = (await $`ls -d ${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-mac-arm64/chrome-headless-shell`.text()).trim();

async function manifest(dir: string): Promise<string[]> {
  const path = `${dir}/manifest.json`;
  if (!existsSync(path)) return [];
  return (await Bun.file(path).json()).scenes;
}

const only = process.argv[2] || null;
const targets: { name: string, dir: string }[] = [];
for (const name of await manifest(`${DIR}/docs`)) targets.push({ name, dir: `${DIR}/docs` });
for (const name of await manifest(`${DIR}/docs/private`)) targets.push({ name, dir: `${DIR}/docs/private` });
const jobs = only ? targets.filter(t => t.name === only) : targets;
if (jobs.length === 0) throw new Error(`no scene named ${only} — run bun build.ts first`);

const browser = await chromium.launch({ executablePath: SHELL });

for (const job of jobs) {
  const frames = `${DIR}/frames-${job.name}`;
  rmSync(frames, { recursive: true, force: true });
  mkdirSync(frames, { recursive: true });

  const page = await browser.newPage({ viewport: { width: 1080, height: 1080 } });
  await page.addInitScript(() => { (window as any).__capture = true; });
  await page.goto(`file://${job.dir}/${job.name}.html`);
  await page.waitForFunction(() => (window as any).__renderFrame !== undefined);

  const total: number = await page.evaluate(() => (window as any).__TOTAL);
  const loops: number = await page.evaluate(() => (window as any).__LOOPS || 1);
  const canvas = page.locator('#c');

  for (let f = 0; f < total; f++) {
    await page.evaluate((n) => (window as any).__renderFrame(n), f);
    await canvas.screenshot({ path: `${frames}/${String(f).padStart(4, '0')}.png` });
  }
  await page.close();

  const out = `${job.dir}/${job.name}.mp4`;
  if (loops > 1) {
    const cycle = `${frames}/cycle.mp4`;
    await $`ffmpeg -y -framerate 24 -i ${frames}/%04d.png -c:v libx264 -pix_fmt yuv420p -crf 18 ${cycle}`.quiet();
    await $`ffmpeg -y -stream_loop ${loops - 1} -i ${cycle} -c copy ${out}`.quiet();
  } else {
    await $`ffmpeg -y -framerate 24 -i ${frames}/%04d.png -c:v libx264 -pix_fmt yuv420p -crf 18 ${out}`.quiet();
  }
  rmSync(frames, { recursive: true, force: true });
  console.log(`wrote ${out.replace(DIR + '/', '')}  (${total} frames × ${loops})`);
}

await browser.close();
