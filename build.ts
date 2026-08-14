// Build every scene into a self-contained HTML file in docs/ (GitHub Pages
// serves docs/ straight from main, no CI).
//
//   bun build.ts
//
// Entries are the .ts files sitting directly in scenes/ plus scenes/private/.
// Shared code lives in subfolders (scenes/gossip/) so the glob skips it.
// Private scenes land in docs/private/, which is gitignored — they exist in
// local builds and never on GitHub.

import { Glob } from 'bun';
import { mkdirSync } from 'node:fs';
import { CLAWD } from './engine/engine';

const DIR = import.meta.dir;

// the favicon is the canonical sprite itself, so it can never drift from him
function faviconSvg(): string {
  let body = '';
  for (let r = 0; r < CLAWD.height; r++)
    for (let c = 0; c < CLAWD.width; c++)
      if (CLAWD.data[r][c]) body += `<rect x="${c + 1}" y="${r + 4}" width="1" height="1"/>`;
  const eyes =
    `<rect x="${CLAWD.eyeLeft.x + 1}" y="${CLAWD.eyeLeft.y + 4}" width="1" height="1"/>` +
    `<rect x="${CLAWD.eyeRight.x + 1}" y="${CLAWD.eyeRight.y + 4}" width="1" height="1"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">`
    + `<g fill="${CLAWD.body}">${body}</g><g fill="${CLAWD.eye}">${eyes}</g></svg>`;
}

function shell(title: string, js: string, icon: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<link rel="icon" href="${icon}" type="image/svg+xml">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #111;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    height: 100vh; overflow: hidden;
    font-family: 'Courier New', monospace;
  }
  canvas { image-rendering: pixelated; width: min(92vh, 92vw); }
  .info { color: #777; font-size: 11px; margin-top: 12px; letter-spacing: 2px; }
</style>
</head>
<body>
<canvas id="c" width="1080" height="1080"></canvas>
<div class="info" id="info"></div>
<script>
${js}
</script>
</body>
</html>
`;
}

async function bundle(entry: string): Promise<string> {
  const result = await Bun.build({ entrypoints: [entry], target: 'browser' });
  if (!result.success) {
    console.error(result.logs.join('\n'));
    throw new Error(`build failed: ${entry}`);
  }
  return await result.outputs[0].text();
}

async function buildScenes(srcDir: string, outDir: string) {
  const names: string[] = [];
  const icon = outDir.endsWith('private') ? '../favicon.svg' : 'favicon.svg';
  mkdirSync(outDir, { recursive: true });
  for (const file of new Glob('*.ts').scanSync(srcDir)) {
    const name = file.replace('.ts', '');
    const js = await bundle(`${srcDir}/${file}`);
    await Bun.write(`${outDir}/${name}.html`, shell(`clawdarium · ${name}`, js, icon));
    names.push(name);
    console.log(`built ${name}.html`);
  }
  names.sort();
  await Bun.write(`${outDir}/manifest.json`, JSON.stringify({ scenes: names }, null, 2));
  return names;
}

const publicScenes = await buildScenes(`${DIR}/scenes`, `${DIR}/docs`);
const privateScenes = await buildScenes(`${DIR}/scenes/private`, `${DIR}/docs/private`);

await Bun.write(`${DIR}/docs/favicon.svg`, faviconSvg());

// the tank: hub/shell.html carries the page, the bundled tank.ts goes inline
const tankJs = await bundle(`${DIR}/hub/tank.ts`);
const hubShell = await Bun.file(`${DIR}/hub/shell.html`).text();
await Bun.write(`${DIR}/docs/index.html`, hubShell.replace('<!--JS-->', tankJs));
console.log(`built index.html (the tank) — ${publicScenes.length} public, ${privateScenes.length} private`);
