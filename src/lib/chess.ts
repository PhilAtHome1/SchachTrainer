import { Chess, type Square } from 'chess.js';
import type { Key } from '@lichess-org/chessground/types';

export type Color = 'w' | 'b';
export type CgColor = 'white' | 'black';
export type PromotionPiece = 'q' | 'r' | 'b' | 'n';

export const cgColor = (c: Color): CgColor => (c === 'w' ? 'white' : 'black');
export const opposite = (c: Color): Color => (c === 'w' ? 'b' : 'w');
export const colorName = (c: Color) => (c === 'w' ? 'Weiß' : 'Schwarz');

/** Legale Zielfelder je Startfeld im Format von chessground. */
export function dests(chess: Chess): Map<Key, Key[]> {
  const map = new Map<Key, Key[]>();
  for (const m of chess.moves({ verbose: true })) {
    const list = map.get(m.from as Key);
    if (list) list.push(m.to as Key);
    else map.set(m.from as Key, [m.to as Key]);
  }
  return map;
}

export function isPromotion(chess: Chess, from: string, to: string): boolean {
  return chess
    .moves({ square: from as Square, verbose: true })
    .some((m) => m.to === to && !!m.promotion);
}

/** Spielt eine Zugliste (SAN) ab der Startstellung ab. */
export function replay(moves: string[], startFen?: string): Chess {
  const chess = startFen ? new Chess(startFen) : new Chess();
  for (const san of moves) chess.move(san);
  return chess;
}

export function lastMoveKeys(chess: Chess): Key[] | undefined {
  const h = chess.history({ verbose: true });
  const last = h[h.length - 1];
  return last ? [last.from as Key, last.to as Key] : undefined;
}

/** Kann die Farbe theoretisch noch mattsetzen? (für Zeitüberschreitung) */
export function canMate(chess: Chess, color: Color): boolean {
  let minors = 0;
  for (const row of chess.board()) {
    for (const p of row) {
      if (!p || p.color !== color || p.type === 'k') continue;
      if (p.type === 'n' || p.type === 'b') minors++;
      else return true;
    }
  }
  return minors >= 2;
}

const START_COUNT = { p: 8, n: 2, b: 2, r: 2, q: 1 } as const;
const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9 } as const;
type Role = keyof typeof START_COUNT;

function countPieces(chess: Chess): Record<Color, Record<Role, number>> {
  const count: Record<Color, Record<Role, number>> = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0 },
  };
  for (const row of chess.board()) for (const p of row) if (p && p.type !== 'k') count[p.color][p.type as Role]++;
  return count;
}

/**
 * Geschlagene Figuren je Farbe (die die Farbe verloren hat) und Materialbilanz.
 * Bei Partien ab einer eigenen Stellung wird gegen diese Startstellung gezählt.
 */
export function captured(chess: Chess, startFen?: string): { lost: Record<Color, Role[]>; diff: number } {
  const count = countPieces(chess);
  const start = startFen ? countPieces(new Chess(startFen)) : { w: { ...START_COUNT }, b: { ...START_COUNT } };
  const lost: Record<Color, Role[]> = { w: [], b: [] };
  let diff = 0;
  for (const c of ['w', 'b'] as Color[]) {
    for (const r of ['q', 'r', 'b', 'n', 'p'] as Role[]) {
      // Umwandlungen können mehr Figuren als zu Beginn ergeben
      const missing = Math.max(0, start[c][r] - count[c][r]);
      for (let i = 0; i < missing; i++) lost[c].push(r);
      diff += (c === 'w' ? 1 : -1) * count[c][r] * VALUE[r];
    }
  }
  return { lost, diff };
}

export const PIECE_SYMBOL: Record<string, string> = { q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };

export function uciOf(m: { from: string; to: string; promotion?: string }): string {
  return m.from + m.to + (m.promotion ?? '');
}

export function parseUci(uci: string): { from: Square; to: Square; promotion?: PromotionPiece } {
  return {
    from: uci.slice(0, 2) as Square,
    to: uci.slice(2, 4) as Square,
    promotion: (uci[4] as PromotionPiece) || undefined,
  };
}
