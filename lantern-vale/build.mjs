import * as esbuild from 'esbuild';
import fs from 'fs';
import { createHash } from 'node:crypto';
const isProd = process.argv.includes('--prod') || process.env.NODE_ENV === 'production';
const r = await esbuild.build({
  entryPoints: ['src/main.js'],
  bundle: true,
  loader: { '.svg': 'text' },
  minify: true,
  format: 'iife',
  write: false,
  target: 'es2020',
  define: { __LV_PROD__: String(isProd) },
});
const js = r.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
const template = fs.readFileSync('src/index.html', 'utf8');
const buildId = createHash('sha256').update(template).update(js).digest('hex').slice(0, 12);
const html = template.replace('__LV_BUILD_ID__', buildId).replace('/*__GAME__*/', () => js);
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/index.html', html);
const fontPath = 'assets/ui/fonts';
fs.cpSync(`game/${fontPath}`, `dist/${fontPath}`, { recursive: true });
console.log('built', (html.length / 1024).toFixed(0) + 'KB');
const fontLicenses = ['OFL.txt', 'LICENSES/ark-pixel/OFL.txt', 'LICENSES/cubic-11/OFL.txt', 'LICENSES/galmuri/LICENSE.txt'];
const fontNotices = fontLicenses.map(file => fs.readFileSync(`game/${fontPath}/${file}`, 'utf8')).join('\n');
const art = html.replace(/url\("(assets\/ui\/fonts\/[^"\n]+\.woff2)"\)/g,
  (_, asset) => `url("data:font/woff2;base64,${fs.readFileSync(`game/${asset}`).toString('base64')}")`)
  .replace('<style>', () => `<!--\n${fontNotices}\n-->\n<style>`)
  .replace(/<!doctype html>\s*/i, '').replace(/<html[^>]*>\s*/i, '').replace(/<\/?head>\s*/gi, '')
  .replace(/<meta charset[^>]*>\s*/i, '').replace(/<meta name="viewport"[^>]*>\s*/i, '').replace(/<body>\s*/i, '').replace(/<\/body>\s*<\/html>\s*$/i, '');
fs.writeFileSync('dist/lantern-vale.html', art);
fs.mkdirSync('game', { recursive: true });
fs.copyFileSync('dist/index.html', 'game/index.html');
