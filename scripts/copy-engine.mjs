// Kopiert die Stockfish-Engine (Single-Thread-Lite-Variante) nach public/engine,
// damit sie vom Service Worker offline gecacht werden kann.
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
const src = 'node_modules/stockfish/bin';
if (existsSync(src)) {
  mkdirSync('public/engine', { recursive: true });
  for (const f of ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm']) {
    copyFileSync(`${src}/${f}`, `public/engine/${f}`);
  }
}
