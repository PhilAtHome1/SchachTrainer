import { useMemo, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import type { Key } from '@lichess-org/chessground/types';
import { Board } from '../components/Board';
import { PositionBuilder, START_BOARD } from '../components/PositionBuilder';
import { Header, PromotionDialog, Segmented } from '../components/ui';
import { cgColor, dests, isPromotion, lastMoveKeys, uciOf, type Color, type PromotionPiece } from '../lib/chess';
import { LEVELS, saveCustomPuzzle, type Level } from '../lib/puzzles';
import { buildFen } from '../lib/position';
import { navigate } from '../router';

export function PuzzleEditor() {
  const [step, setStep] = useState<'position' | 'solution' | 'save'>('position');
  const [board, setBoard] = useState(START_BOARD);
  const [turn, setTurn] = useState<Color>('w');
  const [moves, setMoves] = useState<string[]>([]); // UCI
  const [promo, setPromo] = useState<{ from: Key; to: Key } | null>(null);
  const [name, setName] = useState('');
  const [level, setLevel] = useState<Level>('mittel');
  const [, force] = useState(0);

  const fen = buildFen(board, turn);

  const solutionChess = useMemo(() => {
    if (step === 'position') return null;
    const c = new Chess(fen);
    for (const m of moves) c.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
    return c;
  }, [step, fen, moves]);

  function addMove(from: Key, to: Key, promotion?: PromotionPiece) {
    if (!solutionChess) return;
    const c = new Chess(solutionChess.fen());
    try {
      const m = c.move({ from, to, promotion });
      setMoves([...moves, uciOf(m)]);
    } catch {
      force((x) => x + 1);
    }
  }

  function savePuzzle() {
    saveCustomPuzzle({
      name: name.trim() || `Rätsel ${new Date().toLocaleDateString('de-DE')}`,
      fen,
      moves,
      level,
    });
    navigate('#/raetsel/eigene', true);
  }

  if (step === 'position') {
    return (
      <PositionBuilder
        board={board}
        turn={turn}
        onBoardChange={setBoard}
        onTurnChange={setTurn}
        title="Neues Rätsel · 1/3"
        subtitle="Stellung aufbauen"
        onBack={() => navigate('#/raetsel/eigene')}
        doneLabel="Weiter: Lösung eingeben"
        onDone={() => {
          setMoves([]);
          setStep('solution');
        }}
      />
    );
  }

  if (step === 'solution' && solutionChess) {
    const c = solutionChess;
    const sans = sanMoves(fen, moves);
    return (
      <div className="game-screen editor">
        <div className="game-board-col">
          <div className="replay-head">
            <button className="icon-btn" onClick={() => setStep('position')} aria-label="Zurück">
              ‹
            </button>
            <div>
              <strong>Neues Rätsel · 2/3</strong>
              <div className="muted small">Lösung vorspielen – deine Züge und die Antworten des Gegners</div>
            </div>
          </div>
          <Board
            config={{
              fen: c.fen(),
              orientation: cgColor(turn),
              turnColor: cgColor(c.turn()),
              lastMove: lastMoveKeys(c),
              check: c.inCheck() ? cgColor(c.turn()) : false,
              movable: {
                free: false,
                color: cgColor(c.turn()),
                dests: dests(c),
                events: {
                  after: (from: Key, to: Key) => {
                    if (isPromotion(c, from, to)) setPromo({ from, to });
                    else addMove(from, to);
                  },
                },
              },
              events: { change: undefined, select: undefined },
            }}
          />
        </div>
        <div className="game-side">
          <div className="solution-list">
            {sans.length === 0 ? (
              <span className="muted">Spiele den ersten Lösungszug für {turn === 'w' ? 'Weiß' : 'Schwarz'}.</span>
            ) : (
              sans.map((s, i) => (
                <span key={i} className={'sol-move ' + (i % 2 === 0 ? 'mine' : 'theirs')}>
                  {s}
                </span>
              ))
            )}
          </div>
          <div className="muted small">Grün: Züge, die der Löser finden muss. Grau: Antworten des Gegners (spielt die App automatisch).</div>
          <div className="row gap">
            <button className="btn" onClick={() => setMoves(moves.slice(0, -1))} disabled={moves.length === 0}>
              ↶ Zug zurück
            </button>
            <button className="btn primary grow" onClick={() => setStep('save')} disabled={moves.length === 0}>
              Weiter
            </button>
          </div>
        </div>
        {promo && (
          <PromotionDialog
            color={c.turn()}
            onSelect={(p) => {
              setPromo(null);
              addMove(promo.from, promo.to, p);
            }}
            onCancel={() => {
              setPromo(null);
              force((x) => x + 1);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="screen">
      <Header title="Neues Rätsel · 3/3" back={null} />
      <div className="content">
        <section className="card">
          <label className="field">
            <span>Name</span>
            <input value={name} maxLength={40} placeholder="z. B. Matt in 2 aus dem Vereinsabend" onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="field">
            <span>Schwierigkeit</span>
            <Segmented value={level} onChange={setLevel} options={LEVELS.map((l) => ({ value: l.id, label: l.name }))} />
          </div>
          <div className="muted small">Lösung: {sanMoves(fen, moves).join(' ')}</div>
        </section>
        <div className="row gap">
          <button className="btn" onClick={() => setStep('solution')}>
            Zurück
          </button>
          <button className="btn primary grow" onClick={savePuzzle}>
            Rätsel speichern
          </button>
        </div>
      </div>
    </div>
  );
}

function sanMoves(fen: string, uci: string[]): string[] {
  const c = new Chess(fen);
  return uci.map((m) => c.move({ from: m.slice(0, 2) as Square, to: m.slice(2, 4) as Square, promotion: m[4] }).san);
}
