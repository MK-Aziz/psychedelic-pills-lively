// Regenerates wallpaper/LivelyProperties.json from the SETTINGS list in pills.js,
// then packs the Lively wallpaper into PsychedelicPills.zip (Windows / PowerShell).
//   node tools/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wp = path.join(root, 'wallpaper');

const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(wp, 'pills.js'), 'utf8'), ctx);
const { SETTINGS } = ctx.PillsEngine;

const props = {};
for (const s of SETTINGS) {
  if (s.type === 'slider') {
    props[s.key] = { type: 'slider', value: s.value, min: s.min, max: s.max, step: s.step, text: s.text, help: s.help || s.text };
  } else if (s.type === 'checkbox') {
    props[s.key] = { type: 'checkbox', value: s.value, text: s.text };
  } else if (s.type === 'dropdown') {
    props[s.key] = { type: 'dropdown', value: s.value, text: s.text, items: [...s.items] };
  }
}
fs.writeFileSync(path.join(wp, 'LivelyProperties.json'), JSON.stringify(props, null, 2) + '\n');
console.log(`LivelyProperties.json: ${Object.keys(props).length} settings`);

const files = ['index.html', 'pills.js', 'LivelyInfo.json', 'LivelyProperties.json'].map(f => path.join(wp, f));
const zip = path.join(root, 'PsychedelicPills.zip');
const q = p => `'${p.replace(/'/g, "''")}'`;
execFileSync('powershell', ['-NoProfile', '-Command',
  `Compress-Archive -Force -Path ${files.map(q).join(',')} -DestinationPath ${q(zip)}`], { stdio: 'inherit' });
console.log(`PsychedelicPills.zip: ${(fs.statSync(zip).size / 1024).toFixed(1)} KB`);
