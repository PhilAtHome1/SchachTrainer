// Erzeugt die App-Icons (PNG) aus dem Springer der cburnett-Figuren.
// Aufruf: node scripts/make-icons.mjs  (benötigt Playwright/Chromium)
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const css = readFileSync('node_modules/@lichess-org/chessground/assets/chessground.cburnett.css', 'utf8');
const knight = css.match(/piece\.knight\.white \{\s*background-image: url\('([^']+)'\)/)[1];
const html = (size) => `<html><body style="margin:0"><div style="width:${size}px;height:${size}px;
  background: radial-gradient(circle at 35% 30%, #8a5a30, #3a2414 75%);display:grid;place-items:center">
  <div style="width:${size * 0.72}px;height:${size * 0.72}px;background:url('${knight}') center/contain no-repeat;
  filter: drop-shadow(0 ${size * 0.02}px ${size * 0.03}px rgba(0,0,0,.6))"></div></div></body></html>`;
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(html(size));
  await page.screenshot({ path: `public/icons/${name}` });
}
await browser.close();
