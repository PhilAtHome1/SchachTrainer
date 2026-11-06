import { Chess, validateFen } from 'chess.js';
import type { Color } from './chess';

function castling(board: string): string {
  const rows = board.split('/');
  const at = (sq: string) => {
    const file = sq.charCodeAt(0) - 97;
    const rank = Number(sq[1]);
    let col = 0;
    for (const ch of rows[8 - rank]) {
      if (/\d/.test(ch)) col += Number(ch);
      else {
        if (col === file) return ch;
        col++;
      }
    }
    return '';
  };
  let c = '';
  if (at('e1') === 'K') {
    if (at('h1') === 'R') c += 'K';
    if (at('a1') === 'R') c += 'Q';
  }
  if (at('e8') === 'k') {
    if (at('h8') === 'r') c += 'k';
    if (at('a8') === 'r') c += 'q';
  }
  return c || '-';
}

export function buildFen(board: string, turn: Color) {
  return `${board} ${turn} ${castling(board)} - 0 1`;
}

/** Liefert eine Fehlermeldung oder null, wenn die Stellung spielbar ist. */
export function positionError(fen: string): string | null {
  const board = fen.split(' ')[0];
  const wk = (board.match(/K/g) ?? []).length;
  const bk = (board.match(/k/g) ?? []).length;
  if (wk !== 1 || bk !== 1) return 'Jede Seite braucht genau einen König.';
  const rows = board.split('/');
  if (/[pP]/.test(rows[0]) || /[pP]/.test(rows[7])) return 'Bauern dürfen nicht auf der 1. oder 8. Reihe stehen.';
  const v = validateFen(fen);
  if (!v.ok) return 'Ungültige Stellung.';
  const chess = new Chess(fen);
  const other: Color = chess.turn() === 'w' ? 'b' : 'w';
  const king = chess.findPiece({ type: 'k', color: other })[0];
  if (king && chess.isAttacked(king, chess.turn())) return 'Die Seite, die nicht am Zug ist, darf nicht im Schach stehen.';
  if (chess.moves().length === 0) return 'In dieser Stellung gibt es keinen legalen Zug.';
  return null;
}

