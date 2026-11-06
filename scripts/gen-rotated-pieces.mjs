// Erzeugt um 180° gedrehte schwarze Figuren für den Tischmodus
// (Spieler sitzen sich gegenüber, Schwarz sieht seine Figuren aufrecht).
import { readFileSync, writeFileSync } from 'node:fs';
const css = readFileSync('node_modules/@lichess-org/chessground/assets/chessground.cburnett.css', 'utf8');
const re = /\.cg-wrap piece\.(\w+)\.black \{\s*background-image: url\('data:image\/svg\+xml;base64,([^']+)'\);\s*\}/g;
let out = '/* Generiert von scripts/gen-rotated-pieces.mjs – nicht von Hand bearbeiten */\n';
for (const [, role, b64] of css.matchAll(re)) {
  const svg = Buffer.from(b64, 'base64').toString('utf8');
  const rotated = svg.replace(/(<svg[^>]*>)([\s\S]*)(<\/svg>)/, '$1<g transform="rotate(180 22.5 22.5)">$2</g>$3');
  out += `.table-mode .cg-wrap piece.${role}.black {\n  background-image: url('data:image/svg+xml;base64,${Buffer.from(rotated).toString('base64')}');\n}\n`;
}
writeFileSync('src/styles/pieces-rotated.css', out);
console.log('ok', (out.match(/piece\./g) || []).length);
