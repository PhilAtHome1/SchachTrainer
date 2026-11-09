// Joker: bester Zug von Stockfish als Vorschlag. Unabhängig vom Spielmodus nutzbar –
// der Modus entscheidet selbst, wann und wie oft der Joker erlaubt ist.
import { useCallback, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { Key } from '@lichess-org/chessground/types';
import type { DrawShape } from '@lichess-org/chessground/draw';
import { strongestMove } from './engine';
import { parseUci, type Color } from './chess';

/** Standard: so oft darf jeder Spieler pro Partie den Joker nutzen. */
export const JOKER_MAX = 3;

export interface JokerHint {
  /** Halbzug, für den der Vorschlag gilt (Anzahl gespielter Züge). */
  ply: number;
  /** Stellung, für die der Vorschlag gilt. */
  fen: string;
  uci: string;
  san: string;
  /** Pfeil für das Brett (chessground autoShapes). */
  shapes: DrawShape[];
}

/** Berechnet den besten Zug für eine Stellung (volle Stärke). */
export async function computeJoker(fen: string, ply: number): Promise<JokerHint> {
  const uci = await strongestMove(fen);
  const m = parseUci(uci);
  const san = new Chess(fen).move({ from: m.from, to: m.to, promotion: m.promotion }).san;
  return { ply, fen, uci, san, shapes: [{ orig: m.from as Key, dest: m.to as Key, brush: 'green' }] };
}

/** Verbleibende Joker; `null` bedeutet unbegrenzt. */
export function jokersLeft(used: Partial<Record<Color, number>> | undefined, color: Color, max: number | null = JOKER_MAX): number | null {
  if (max === null) return null;
  return Math.max(0, max - (used?.[color] ?? 0));
}

export function addJokerUse(used: Partial<Record<Color, number>> | undefined, color: Color): Record<Color, number> {
  const next = { w: used?.w ?? 0, b: used?.b ?? 0 };
  next[color] += 1;
  return next;
}

/**
 * React-Hook für den Joker in einer Partie.
 * - `request(onUsed)` berechnet den Vorschlag für die aktuelle Stellung. `onUsed` wird nur
 *   aufgerufen, wenn ein Vorschlag geliefert wurde (dort zählt der Modus den Verbrauch).
 *   Ist die Engine nicht verfügbar oder wurde inzwischen gezogen, wird nichts verbraucht.
 * - `hint` ist nur gesetzt, solange die Stellung unverändert ist.
 */
export function useJoker(fen: string, ply: number) {
  const [hint, setHint] = useState<JokerHint | null>(null);
  const [loading, setLoading] = useState(false);
  const plyRef = useRef(ply);
  plyRef.current = ply;
  const current = hint && hint.ply === ply && hint.fen === fen ? hint : null;

  const request = useCallback(
    async (onUsed?: (h: JokerHint) => void): Promise<JokerHint | null> => {
      if (loading || current || !fen) return current;
      setLoading(true);
      try {
        const h = await computeJoker(fen, ply);
        if (plyRef.current !== ply) return null; // inzwischen gezogen
        setHint(h);
        onUsed?.(h);
        return h;
      } catch {
        return null;
      } finally {
        setLoading(false);
      }
    },
    [fen, ply, loading, current],
  );

  return { hint: current, shapes: current?.shapes ?? [], loading, request };
}
