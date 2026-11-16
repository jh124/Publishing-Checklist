import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { publicFiles } from './public-files.mjs';
const root = resolve('.');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const argument = name => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const port = Number(argument('--port') || process.env.PORT || 3000);
const host = argument('--host') || '0.0.0.0';
createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const filename = pathname === '/' ? 'index.html' : pathname.slice(1);
    if (!publicFiles.includes(filename)) throw new Error('Not a public asset');
    const target = resolve(root, filename);
    if (!target.startsWith(`${root}/`)) throw new Error('Invalid path');
    const file = await readFile(target);
    res.writeHead(200, { 'Content-Type': types[extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(file);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, host, () => console.log(`Publishing Checklist is ready on port ${port}.`));
