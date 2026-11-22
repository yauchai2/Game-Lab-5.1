import * as esbuild from 'esbuild';
import fs from 'fs';
const r = await esbuild.build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', write: false, target: 'es2020' });
const js = r.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
const html = fs.readFileSync('src/index.html', 'utf8').replace('/*__GAME__*/', () => js);
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/index.html', html);
console.log('built', (html.length / 1024).toFixed(0) + 'KB');
const art = html.replace(/<!doctype html>\s*/i, '').replace(/<html[^>]*>\s*/i, '').replace(/<\/?head>\s*/gi, '')
  .replace(/<meta charset[^>]*>\s*/i, '').replace(/<meta name="viewport"[^>]*>\s*/i, '').replace(/<body>\s*/i, '').replace(/<\/body>\s*<\/html>\s*$/i, '');
fs.writeFileSync('dist/lantern-vale.html', art);
