import { mkdir, copyFile, rm } from 'node:fs/promises';
import { publicFiles } from './public-files.mjs';

// GitHub Pages serves the root directly. Other static hosts can use this copy.
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await Promise.all(publicFiles.map(filename => copyFile(filename, `dist/${filename}`)));
console.log(`Prepared ${publicFiles.length} static files in dist.`);
