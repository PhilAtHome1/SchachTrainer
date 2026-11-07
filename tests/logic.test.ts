import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { canMate, captured, isPromotion, replay } from '../src/lib/chess';
import { buildFen, positionError } from '../src/lib/position';
import { checkMove, decodePuzzle, encodePuzzle, pickNext, type Puzzle } from '../src/lib/puzzles';

describe('Schachlogik', () => {
  it('erkennt Umwandlungszüge', () => {
    const c = new Chess('8/4P3/8/8/8/8/k7/4K3 w - - 0 1');
    expect(isPromotion(c, 'e7', 'e8')).toBe(true);
    expect(isPromotion(c, 'e1', 'e2')).toBe(false);
  });

  it('spielt Partien aus SAN ab', () => {
    const c = replay(['f3', 'e5', 'g4', 'Qh4#']);
    expect(c.isCheckmate()).toBe(true);
  });

  it('prüft Mattmaterial bei Zeitüberschreitung', () => {
    expect(canMate(new Chess('8/8/8/8/8/8/k7/4K2N w - - 0 1'), 'w')).toBe(false);
    expect(canMate(new Chess('8/8/8/8/8/8/k7/4KB1N w - - 0 1'), 'w')).toBe(true);
    expect(canMate(new Chess('8/8/8/8/8/8/k6P/4K3 w - - 0 1'), 'w')).toBe(true);
  });

  it('zählt geschlagene Figuren', () => {
    const c = replay(['e4', 'd5', 'exd5']);
    const r = captured(c);
    expect(r.lost.b).toEqual(['p']);
    expect(r.diff).toBe(1);
  });
});

describe('Rätsel', () => {
  it('akzeptiert den erwarteten Zug und alternative Mattzüge', () => {
    // Weiß hat zwei Mattzüge: Ta8# und Tb8#
    const fen = '6k1/5ppp/8/8/8/8/8/RR4K1 w - - 0 1';
    expect(checkMove(fen, 'a1a8', 'a1a8')).toBe(true);
    expect(checkMove(fen, 'a1a8', 'b1b8')).toBe(true);
    expect(checkMove(fen, 'a1a8', 'a1a7')).toBe(false);
  });

  it('wählt bevorzugt neue Rätsel', () => {
    const list = ['a', 'b', 'c'].map((id) => ({ id }) as Puzzle);
    const p = pickNext(list, { solved: ['a'], failed: ['b'] });
    expect(p.id).toBe('c');
    const q = pickNext(list, { solved: ['a', 'c'], failed: ['b'] });
    expect(q.id).toBe('b');
  });

  it('kodiert eigene Rätsel zum Teilen und liest sie wieder ein', () => {
    const p = { id: 'x', createdAt: 0, name: 'Grundreihe – Ü', fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', moves: ['a1a8'], level: 'leicht' as const };
    const back = decodePuzzle(encodePuzzle(p));
    expect(back).toEqual({ name: p.name, fen: p.fen, moves: p.moves, level: 'leicht' });
    expect(decodePuzzle('SCHACH:kaputt')).toBeNull();
  });
});

describe('Stellungseditor', () => {
  it('setzt Rochaderechte automatisch', () => {
    expect(buildFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR', 'w')).toBe(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    );
    expect(buildFen('6k1/8/8/8/8/8/8/R5K1', 'b')).toBe('6k1/8/8/8/8/8/8/R5K1 b - - 0 1');
  });

  it('meldet ungültige Stellungen', () => {
    expect(positionError(buildFen('8/8/8/8/8/8/8/R5K1', 'w'))).toMatch(/König/);
    expect(positionError(buildFen('P5k1/8/8/8/8/8/8/6K1', 'w'))).toMatch(/Bauern/);
    expect(positionError(buildFen('6k1/8/8/8/8/8/8/R5K1', 'b'))).toBeNull();
    // Schwarz am Zug, aber Weiß steht im Schach
    expect(positionError(buildFen('6k1/8/8/8/8/8/8/r5K1', 'b'))).toMatch(/Schach/);
  });
});

describe('Material ab eigener Stellung', () => {
  it('zählt nur Figuren, die seit der Startstellung geschlagen wurden', () => {
    const start = '4k2r/8/8/8/8/8/8/3QK3 w - - 0 1';
    const c = new Chess(start);
    expect(captured(c, start).lost).toEqual({ w: [], b: [] });
    c.move('Qd8+');
    c.move('Kxd8');
    expect(captured(c, start).lost).toEqual({ w: ['q'], b: [] });
  });
});
