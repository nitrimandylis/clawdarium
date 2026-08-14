// Serve docs/ locally so the tank's manifest fetches work (file:// blocks
// fetch). Private scenes only exist here — GitHub Pages never has them.
//
//   bun serve.ts        → http://localhost:4550

const DIR = import.meta.dir;

Bun.serve({
  port: 4550,
  async fetch(req) {
    let path = new URL(req.url).pathname;
    if (path.endsWith('/')) path += 'index.html';
    const file = Bun.file(`${DIR}/docs${path}`);
    if (await file.exists()) return new Response(file);
    return new Response('not found', { status: 404 });
  }
});

console.log('clawdarium swimming at http://localhost:4550');
