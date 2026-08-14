# clawdarium

An aquarium for Clawd. Every pixel animation ever made for Claude Code's crab
mascot lives here as a scene on one shared engine, and every scene is a crab
wandering a live pixel tank on GitHub Pages. Click a crab, watch its clip.

## What it is

- **engine/engine.ts**: the canonical Clawd pixel engine, written from
  scratch 2026-08-14. 36×36 grid at 1080×1080, 24fps, deterministic
  `render(f)` (seeded `rnd`, stateless particles), the 14×8 Clawd sprite,
  eye variants, a 5×9 pixel font, easing/timing helpers. Everything draws
  through the grid, no `fillText`, no anti-aliasing.
- **scenes/**: one .ts file per animation, importing the engine, ending in
  `run(scene)`. Shared per-group code lives in subfolders (`scenes/gossip/`).
  `scenes/private/` is gitignored: personal scenes build and render locally
  and never reach GitHub.
- **build.ts**: bundles each scene into a self-contained `docs/<name>.html`
  (live preview + `window.__renderFrame(f)` capture contract) and generates
  the tank at `docs/index.html` from `hub/`.
- **render.ts**: pulls frames deterministically via the playwright headless
  shell, stitches `docs/<name>.mp4` with ffmpeg.
- **hub/**: the aquarium, a live canvas tank. One half-scale crab per scene,
  discovered from `manifest.json` (+ `private/manifest.json` locally), each
  wearing its name; click for an overlay clip. Designed as a Hallmark bespoke
  custom theme; page tokens live in `hub/shell.html`'s `:root` block.
- **docs/** is committed: GitHub Pages serves it from main, no CI.

## Current scenes

- `gossip-overheard`, `gossip-telephone`, `gossip-the-board`,
  `gossip-collapse`: the four loosethreads promo clips, ported from the
  original clawd-gossip project.
- `pearl`: Clawd taps a shell open and finds a pearl. The first
  aquarium-native scene, made via the clawdarium skill flow.
- `dione` (private, local only).

## Checks

- `bun run check` (check.ts): engine math asserts, then every built scene
  renders frame 60, renders other frames, and renders frame 60 again; the
  captures must be byte-identical. Guards the pure-render(f) contract that
  the mp4 pipeline depends on.

## Where it's headed

- New scenes arrive via the `clawdarium` skill: brief → scene file → build →
  render → commit, one more crab in the tank.
- The originals (`~/cc/clawd-gossip`, `~/cc/clawd-dione`) are kept as archive;
  this repo is canonical.
