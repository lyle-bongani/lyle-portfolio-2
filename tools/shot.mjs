// npm run shot -- <url> <file-name> [Enter | "text of an intro button to click"]
// Opens the site in Chrome at 1600x940 and saves public/media/projects/<file-name>.jpg, ready to use as a project image.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [url, name, gate = ''] = process.argv.slice(2);
if (!url || !name) {
  console.log('usage: npm run shot -- <url> <file-name> [Enter | "intro button text"]');
  process.exit(1);
}
const CHROME = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe']
  .filter(Boolean).find((p) => fs.existsSync(p));
if (!CHROME) throw new Error('Chrome not found. Set the CHROME environment variable to its path.');

const port = 9300 + Math.floor(Math.random() * 500);
const profile = path.join(os.tmpdir(), `shot-${port}`);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1600,940', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let targets;
for (let i = 0; i < 60; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.find((t) => t.type === 'page')) break; } catch { /* still starting */ }
  await sleep(250);
}
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 940, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url });
await sleep(9000); // let fonts, 3D and intro animations settle
if (gate === 'Enter') {
  for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await sleep(7000);
} else if (gate) {
  await send('Runtime.evaluate', {
    expression: `(() => { const want = ${JSON.stringify(gate.toLowerCase())};
      const el = [...document.querySelectorAll('button, a, [role=button], div, span')].filter(e => e.children.length < 3 && (e.textContent || '').trim().toLowerCase() === want).pop();
      if (el) el.click(); })()`,
  });
  await sleep(7000);
}
const shot = await send('Page.captureScreenshot', { format: 'png' });
ws.close();
chrome.kill();

const out = path.join('public', 'media', 'projects', `${name}.jpg`);
fs.mkdirSync(path.dirname(out), { recursive: true });
const tmp = path.join(os.tmpdir(), `${name}.png`);
fs.writeFileSync(tmp, Buffer.from(shot.result.data, 'base64'));
const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', tmp, '-vf', 'scale=1440:-2', '-q:v', '3', out]);
if (r.status !== 0) { fs.copyFileSync(tmp, out.replace('.jpg', '.png')); console.log('ffmpeg not found; saved the PNG instead'); } else console.log('saved', out);
process.exit(0);
