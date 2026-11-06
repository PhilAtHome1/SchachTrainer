import { useMemo, useRef, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import type { Api } from '@lichess-org/chessground/api';
import type { Key, Piece, Role } from '@lichess-org/chessground/types';
import { Board } from '../components/Board';
import { Header, PromotionDialog, Segmented } from '../components/ui';
import { cgColor, dests, isPromotion, lastMoveKeys, uciOf, type Color, type PromotionPiece } from '../lib/chess';
import { LEVELS, saveCustomPuzzle, type Level } from '../lib/puzzles';
import { buildFen, positionError } from '../lib/position';
import { navigate } from '../router';

const START_BOARD = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
const ROLES: Role[] = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'];
type Tool = 'move' | 'erase' | { color: 'white' | 'black'; role: Role };

export function PuzzleEditor() {
  const [step, setStep] = useState<'position' | 'solution' | 'save'>('position');
  const [board, setBoard] = useState(START_BOARD);
  const [turn, setTurn] = useState<Color>('w');
  const [tool, setTool] = useState<Tool>('move');
  const [fenInput, setFenInput] = useState('');
  const [error, setError] = useState('');
  const [moves, setMoves] = useState<string[]>([]); // UCI
  const [promo, setPromo] = useState<{ from: Key; to: Key } | null>(null);
  const [name, setName] = useState('');
  const [level, setLevel] = useState<Level>('mittel');
  const [, force] = useState(0);
  const api = useRef<Api | null>(null);
  const toolRef = useRef<Tool>(tool);
  toolRef.current = tool;

  const fen = buildFen(board, turn);

  const solutionChess = useMemo(() => {
    if (step === 'position') return null;
    const c = new Chess(fen);
    for (const m of moves) c.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
    return c;
  }, [step, fen, moves]);

  function syncBoard() {
    if (api.current) setBoard(api.current.getFen());
  }

  function onSelect(key: Key) {
    const t = toolRef.current;
    const a = api.current;
    if (!a || t === 'move') return;
    const diff = new Map<Key, Piece | undefined>();
    if (t === 'erase') diff.set(key, undefined);
    else diff.set(key, { color: t.color, role: t.role });
    a.setPieces(diff);
    a.selectSquare(null);
    syncBoard();
  }

  function loadFen() {
    const f = fenInput.trim();
    const parts = f.split(/\s+/);
    if (!/^([1-8pnbrqkPNBRQK]+\/){7}[1-8pnbrqkPNBRQK]+$/.test(parts[0] ?? '')) {
      setError('Das ist keine gültige FEN.');
      return;
    }
    setBoard(parts[0]);
    setTurn(parts[1] === 'b' ? 'b' : 'w');
    setError('');
    setFenInput('');
  }

  function toSolution() {
    const e = positionError(fen);
    if (e) {
      setError(e);
      return;
    }
    setError('');
    setMoves([]);
    setStep('solution');
  }

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

  const isTool = (t: Tool) =>
    typeof t === 'string' ? tool === t : typeof tool === 'object' && tool.color === t.color && tool.role === t.role;

  const palette = (color: 'white' | 'black') => (
    <div className="palette cg-wrap">
      {ROLES.map((role) => (
        <button
          key={role}
          className={'pal-btn' + (isTool({ color, role }) ? ' active' : '')}
          onClick={() => setTool({ color, role })}
          aria-label={`${color} ${role}`}
        >
          <piece className={`${role} ${color}`} />
        </button>
      ))}
    </div>
  );

  if (step === 'position') {
    return (
      <div className="game-screen editor">
        <div className="game-board-col">
          <div className="replay-head">
            <button className="icon-btn" onClick={() => navigate('#/raetsel/eigene')} aria-label="Zurück">
              ‹
            </button>
            <div>
              <strong>Neues Rätsel · 1/3</strong>
              <div className="muted small">Stellung aufbauen</div>
            </div>
          </div>
          {palette('black')}
          <Board
            apiRef={api}
            config={{
              fen: board,
              orientation: 'white',
              lastMove: undefined,
              check: false,
              movable: { free: true, color: 'both', showDests: false },
              draggable: { deleteOnDropOff: true },
              events: { change: syncBoard, select: onSelect },
              highlight: { lastMove: false, check: false },
            }}
          />
          {palette('white')}
        </div>
        <div className="game-side">
          <div className="chip-grid">
            <button className={'chip' + (tool === 'move' ? ' active' : '')} onClick={() => setTool('move')}>
              ✋ Verschieben
            </button>
            <button className={'chip' + (tool === 'erase' ? ' active' : '')} onClick={() => setTool('erase')}>
              ⌫ Entfernen
            </button>
            <button className="chip" onClick={() => setBoard(START_BOARD)}>
              Grundstellung
            </button>
            <button className="chip" onClick={() => setBoard('8/8/8/8/8/8/8/8')}>
              Leeres Brett
            </button>
          </div>
          <div className="field-row">
            <span>Am Zug:</span>
            <Segmented
              value={turn}
              onChange={setTurn}
              options={[
                { value: 'w', label: 'Weiß' },
                { value: 'b', label: 'Schwarz' },
              ]}
            />
          </div>
          <div className="row gap">
            <input className="grow" placeholder="FEN einfügen (optional)" value={fenInput} onChange={(e) => setFenInput(e.target.value)} />
            <button className="btn" onClick={loadFen} disabled={!fenInput.trim()}>
              Laden
            </button>
          </div>
          <div className="muted small">Tipp: Figur auswählen und aufs Feld tippen. Figuren vom Brett ziehen entfernt sie.</div>
          {error && <div className="bad">{error}</div>}
          <button className="btn primary big" onClick={toSolution}>
            Weiter: Lösung eingeben
          </button>
        </div>
      </div>
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
