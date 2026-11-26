// Beaconfall Phase 0: report CJK display strings and legacy brand names. Read-only.
// Usage: node scripts/audit_strings.mjs [--write]   (--write saves docs/beaconfall/STRING_AUDIT.md)
import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const legacy = /燈谷行|Lantern Vale|LANTERN VALE/g;
const cjk = /[一-鿿]/;
const rows = []; let legacyTotal = 0;
for (const f of fs.readdirSync(path.join(root, 'src')).filter(n => /\.(js|html)$/.test(n))) {
  const lines = fs.readFileSync(path.join(root, 'src', f), 'utf8').split('\n');
  let c = 0, l = 0;
  for (const ln of lines) { if (cjk.test(ln)) c++; l += (ln.match(legacy) || []).length; }
  legacyTotal += l; rows.push({ f: 'src/' + f, cjkLines: c, legacy: l });
}
rows.sort((a, b) => b.cjkLines - a.cjkLines);
const md = ['# String audit (generated)', '', `Legacy brand mentions in src/: **${legacyTotal}**`, '', '| file | lines with CJK | legacy brand hits |', '|---|---|---|', ...rows.filter(r => r.cjkLines || r.legacy).map(r => `| ${r.f} | ${r.cjkLines} | ${r.legacy} |`), ''].join('\n');
if (process.argv.includes('--write')) fs.writeFileSync(path.join(root, 'docs/beaconfall/STRING_AUDIT.md'), md); else console.log(md);
