import { load, remove, save } from './storage';
import { replay, type Color } from './chess';

export type ViewMode = 'table' | 'pass';
export type Result = '1-0' | '0-1' | '1/2-1/2';

export interface TimeControl {
  initial: number; // Sekunden
  inc: number; // Sekunden Zeitzuschlag pro Zug
}

export interface GameRecord {
  id: string;
  mode: 'local' | 'engine' | 'online';
  createdAt: number;
  updatedAt: number;
  white: string;
  black: string;
  startFen?: string;
  moves: string[]; // SAN
  tc: TimeControl | null;
  clock?: Record<Color, number>; // verbleibende Millisekunden
  view: ViewMode;
  engineLevel?: number;
  humanColor?: Color;
  result?: Result;
  reason?: string;
  /** Verbrauchte Joker je Farbe */
  jokers?: Record<Color, number>;
}

/** So oft darf jeder Spieler pro Partie den Joker (bester Zug von Stockfish) nutzen. */
export const JOKER_MAX = 3;

const CURRENT = 'current-game';
const HISTORY = 'history';
const MAX_HISTORY = 300;

export const getCurrent = () => load<GameRecord | null>(CURRENT, null);
export const setCurrent = (g: GameRecord) => save(CURRENT, g);
export const clearCurrent = () => remove(CURRENT);

export const getHistory = () => load<GameRecord[]>(HISTORY, []);

export function addToHistory(g: GameRecord) {
  const list = getHistory().filter((x) => x.id !== g.id);
  list.unshift(g);
  save(HISTORY, list.slice(0, MAX_HISTORY));
}

export function deleteFromHistory(id: string) {
  save(HISTORY, getHistory().filter((x) => x.id !== id));
}

export function resultText(g: GameRecord): string {
  if (!g.result) return 'Läuft';
  if (g.result === '1/2-1/2') return 'Remis';
  return g.result === '1-0' ? `${g.white} gewinnt` : `${g.black} gewinnt`;
}

export function toPgn(g: GameRecord): string {
  const chess = replay(g.moves, g.startFen);
  const d = new Date(g.createdAt);
  const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  chess.setHeader('Event', g.mode === 'engine' ? 'Partie gegen Computer' : g.mode === 'online' ? 'Online-Partie' : 'Lokale Partie');
  chess.setHeader('Site', 'SchachTrainer');
  chess.setHeader('Date', date);
  chess.setHeader('White', g.white);
  chess.setHeader('Black', g.black);
  chess.setHeader('Result', g.result ?? '*');
  if (g.tc) chess.setHeader('TimeControl', `${g.tc.initial}+${g.tc.inc}`);
  if (g.reason) chess.setHeader('Termination', g.reason);
  return chess.pgn();
}
