import { Chess } from 'chess.js';
import { load, save, uid } from './storage';
import { parseUci } from './chess';

export type Level = 'leicht' | 'mittel' | 'schwer';

export const LEVELS: { id: Level; name: string; range: string }[] = [
  { id: 'leicht', name: 'Leicht', range: 'Wertung 400–1200' },
  { id: 'mittel', name: 'Mittel', range: 'Wertung 1200–1800' },
  { id: 'schwer', name: 'Schwer', range: 'Wertung 1800–2700' },
];

export interface Puzzle {
  id: string;
  fen: string;
  /** Lösung in UCI. */
  moves: string[];
  /** Lichess-Rätsel: der erste Zug ist der Zug des Gegners, der die Aufgabe auslöst. */
  opponentStarts: boolean;
  rating?: number;
  themes?: string[];
  name?: string;
  level: Level;
  custom?: boolean;
}

export interface CustomPuzzle {
  id: string;
  name: string;
  fen: string;
  moves: string[];
  level: Level;
  createdAt: number;
}

type RawPuzzle = [string, string, string, number, string];

const cache = new Map<Level, Puzzle[]>();

export async function loadLevel(level: Level): Promise<Puzzle[]> {
  const hit = cache.get(level);
  if (hit) return hit;
  const res = await fetch(`${import.meta.env.BASE_URL}puzzles/${level}.json`);
  const raw = (await res.json()) as RawPuzzle[];
  const list = raw.map(([id, fen, moves, rating, themes]) => ({
    id,
    fen,
    moves: moves.split(' '),
    opponentStarts: true,
    rating,
    themes: themes.split(' '),
    level,
  }));
  cache.set(level, list);
  return list;
}

// ---------- Fortschritt ----------

export interface LevelProgress {
  solved: string[]; // ohne Fehler und ohne Hilfe gelöst
  failed: string[]; // mit Fehler, Hinweis oder Lösung angezeigt
}

type Progress = Record<string, LevelProgress>;

export function getProgress(key: string): LevelProgress {
  const p = load<Progress>('puzzle-progress', {});
  return p[key] ?? { solved: [], failed: [] };
}

export function recordAttempt(key: string, id: string, success: boolean) {
  const all = load<Progress>('puzzle-progress', {});
  const p = all[key] ?? { solved: [], failed: [] };
  p.solved = p.solved.filter((x) => x !== id);
  p.failed = p.failed.filter((x) => x !== id);
  (success ? p.solved : p.failed).push(id);
  all[key] = p;
  save('puzzle-progress', all);
}

/** Wählt ein noch nicht versuchtes Rätsel, sonst ein falsch gelöstes, sonst irgendeins. */
export function pickNext(list: Puzzle[], progress: LevelProgress, exclude?: string): Puzzle {
  const done = new Set([...progress.solved, ...progress.failed]);
  let pool = list.filter((p) => !done.has(p.id) && p.id !== exclude);
  if (pool.length === 0) {
    const failed = new Set(progress.failed);
    pool = list.filter((p) => failed.has(p.id) && p.id !== exclude);
  }
  if (pool.length === 0) pool = list.filter((p) => p.id !== exclude);
  if (pool.length === 0) pool = list;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ---------- Lösungsprüfung ----------

/**
 * Prüft einen Spielerzug. Richtig ist der erwartete Zug – oder jeder Zug,
 * der sofort mattsetzt (bei Mattaufgaben gibt es manchmal mehrere Lösungen).
 */
export function checkMove(fenBefore: string, expectedUci: string, playedUci: string): boolean {
  if (playedUci === expectedUci) return true;
  try {
    const chess = new Chess(fenBefore);
    chess.move(parseUci(playedUci));
    return chess.isCheckmate();
  } catch {
    return false;
  }
}

// ---------- Eigene Rätsel ----------

export const getCustomPuzzles = () => load<CustomPuzzle[]>('custom-puzzles', []);

export function saveCustomPuzzle(p: Omit<CustomPuzzle, 'id' | 'createdAt'> & { id?: string }) {
  const list = getCustomPuzzles();
  const entry: CustomPuzzle = { ...p, id: p.id ?? uid(), createdAt: Date.now() };
  save('custom-puzzles', [entry, ...list.filter((x) => x.id !== entry.id)]);
  return entry;
}

export function deleteCustomPuzzle(id: string) {
  save('custom-puzzles', getCustomPuzzles().filter((x) => x.id !== id));
}

export function customToPuzzle(c: CustomPuzzle): Puzzle {
  return { id: c.id, fen: c.fen, moves: c.moves, opponentStarts: false, name: c.name, level: c.level, custom: true };
}

/** Rätsel als Text-Code zum Teilen mit Freunden. */
export function encodePuzzle(c: CustomPuzzle): string {
  const json = JSON.stringify({ n: c.name, f: c.fen, m: c.moves.join(' '), l: c.level });
  return 'SCHACH:' + btoa(unescape(encodeURIComponent(json)));
}

export function decodePuzzle(code: string): Omit<CustomPuzzle, 'id' | 'createdAt'> | null {
  try {
    const trimmed = code.trim().replace(/^SCHACH:/, '');
    const o = JSON.parse(decodeURIComponent(escape(atob(trimmed))));
    if (typeof o.f !== 'string' || typeof o.m !== 'string') return null;
    // Lösung auf Gültigkeit prüfen
    const chess = new Chess(o.f);
    const moves = o.m.split(' ').filter(Boolean);
    for (const m of moves) chess.move(parseUci(m));
    if (moves.length === 0) return null;
    const level: Level = ['leicht', 'mittel', 'schwer'].includes(o.l) ? o.l : 'mittel';
    return { name: String(o.n || 'Importiertes Rätsel'), fen: o.f, moves, level };
  } catch {
    return null;
  }
}

// ---------- Themen (Anzeige nach dem Lösen) ----------

const THEMES: Record<string, string> = {
  mate: 'Matt',
  mateIn1: 'Matt in 1',
  mateIn2: 'Matt in 2',
  mateIn3: 'Matt in 3',
  mateIn4: 'Matt in 4',
  mateIn5: 'Matt in 5+',
  fork: 'Gabel',
  pin: 'Fesselung',
  skewer: 'Spieß',
  sacrifice: 'Opfer',
  discoveredAttack: 'Abzugsangriff',
  doubleCheck: 'Doppelschach',
  hangingPiece: 'Hängende Figur',
  trappedPiece: 'Gefangene Figur',
  backRankMate: 'Grundreihenmatt',
  smotheredMate: 'Ersticktes Matt',
  deflection: 'Ablenkung',
  attraction: 'Hinlenkung',
  interference: 'Unterbrechung',
  clearance: 'Räumung',
  intermezzo: 'Zwischenzug',
  quietMove: 'Stiller Zug',
  xRayAttack: 'Röntgenangriff',
  zugzwang: 'Zugzwang',
  promotion: 'Umwandlung',
  underPromotion: 'Unterverwandlung',
  enPassant: 'En passant',
  castling: 'Rochade',
  capturingDefender: 'Verteidiger schlagen',
  exposedKing: 'Ungeschützter König',
  kingsideAttack: 'Königsangriff',
  queensideAttack: 'Damenflügelangriff',
  advancedPawn: 'Weit vorgerückter Bauer',
  defensiveMove: 'Verteidigung',
  equality: 'Ausgleich',
  endgame: 'Endspiel',
  middlegame: 'Mittelspiel',
  opening: 'Eröffnung',
  rookEndgame: 'Turmendspiel',
  pawnEndgame: 'Bauernendspiel',
  queenEndgame: 'Damenendspiel',
  bishopEndgame: 'Läuferendspiel',
  knightEndgame: 'Springerendspiel',
  anastasiaMate: 'Anastasias Matt',
  arabianMate: 'Arabisches Matt',
  bodenMate: 'Bodens Matt',
  hookMate: 'Hakenmatt',
  dovetailMate: 'Schwalbenschwanzmatt',
};

export function themeNames(themes?: string[]): string[] {
  return (themes ?? []).map((t) => THEMES[t]).filter((x): x is string => !!x);
}
