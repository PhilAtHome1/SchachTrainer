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

import { isMyTurn, myColor, remainingMs, type OnlineGame } from '../src/lib/online';

describe('Online-Hilfen', () => {
  const base = {
    status: 'active',
    white_id: 'A',
    black_id: 'B',
    fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    moves: ['e4'],
    tc_initial: 60,
    tc_inc: 0,
    clock_w: 60000,
    clock_b: 60000,
    last_move_at: new Date(1_000_000).toISOString(),
  } as unknown as OnlineGame;

  it('bestimmt Farbe und Zugrecht', () => {
    expect(myColor(base, 'A')).toBe('w');
    expect(myColor(base, 'X')).toBeNull();
    expect(isMyTurn(base, 'B')).toBe(true);
    expect(isMyTurn(base, 'A')).toBe(false);
  });

  it('zieht nur beim Spieler am Zug Zeit ab', () => {
    expect(remainingMs(base, 'b', 1_000_000 + 5000)).toBe(55000);
    expect(remainingMs(base, 'w', 1_000_000 + 5000)).toBe(60000);
    expect(remainingMs({ ...base, tc_initial: null }, 'w', 0)).toBeNull();
  });
});

import { normalizeKey, normalizeSupabaseUrl } from '../src/lib/online';

describe('Supabase-Konfiguration', () => {
  it('reduziert die Adresse auf die Project URL', () => {
    expect(normalizeSupabaseUrl('https://abcd.supabase.co')).toBe('https://abcd.supabase.co');
    expect(normalizeSupabaseUrl('https://abcd.supabase.co/')).toBe('https://abcd.supabase.co');
    expect(normalizeSupabaseUrl(' https://abcd.supabase.co/rest/v1/ ')).toBe('https://abcd.supabase.co');
    expect(normalizeSupabaseUrl('"abcd.supabase.co"')).toBe('https://abcd.supabase.co');
    expect(normalizeSupabaseUrl('')).toBeUndefined();
    expect(normalizeSupabaseUrl('https://')).toBeUndefined();
  });
  it('bereinigt den Key', () => {
    expect(normalizeKey(' "sb_publishable_x"\n')).toBe('sb_publishable_x');
    expect(normalizeKey('  ')).toBeUndefined();
  });
});

describe('Uhr nach Zeitüberschreitung', () => {
  it('zeigt beim Verlierer 0, auch wenn der Server die alte Restzeit gespeichert hat', () => {
    const g = {
      status: 'finished',
      result: '1-0',
      reason: 'Zeitüberschreitung',
      tc_initial: 60,
      clock_w: 900,
      clock_b: 2400,
      moves: ['e4'],
      fen: 'x b - - 0 1',
      last_move_at: new Date(0).toISOString(),
    } as unknown as OnlineGame;
    expect(remainingMs(g, 'b', 10_000)).toBe(0);
    expect(remainingMs(g, 'w', 10_000)).toBe(900);
  });
});
