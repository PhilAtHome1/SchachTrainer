import { useRef, useState, type ReactNode } from 'react';
import type { Api } from '@lichess-org/chessground/api';
import type { Key, Piece, Role } from '@lichess-org/chessground/types';
import { Board } from './Board';
import { Segmented } from './ui';
import type { Color } from '../lib/chess';
import { buildFen, positionError } from '../lib/position';

export const START_BOARD = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
const ROLES: Role[] = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'];
type Tool = 'move' | 'erase' | { color: 'white' | 'black'; role: Role };

interface Props {
  board: string;
  turn: Color;
  onBoardChange: (board: string) => void;
  onTurnChange: (turn: Color) => void;
  title: string;
  subtitle: string;
  onBack: () => void;
  doneLabel: string;
  /** Wird mit der vollständigen FEN aufgerufen, wenn die Stellung gültig ist. */
  onDone: (fen: string) => void;
  /** Zusätzliche Einstellungen unter dem Brett (z. B. Spielstärke). */
  extra?: ReactNode;
}

/** Stellungseditor: Figuren setzen, verschieben, entfernen, FEN laden. */
export function PositionBuilder({ board, turn, onBoardChange, onTurnChange, title, subtitle, onBack, doneLabel, onDone, extra }: Props) {
  const [tool, setTool] = useState<Tool>('move');
  const [fenInput, setFenInput] = useState('');
  const [error, setError] = useState('');
  const api = useRef<Api | null>(null);
  const toolRef = useRef<Tool>(tool);
  toolRef.current = tool;

  function syncBoard() {
    if (api.current) onBoardChange(api.current.getFen());
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
    const parts = fenInput.trim().split(/\s+/);
    if (!/^([1-8pnbrqkPNBRQK]+\/){7}[1-8pnbrqkPNBRQK]+$/.test(parts[0] ?? '')) {
      setError('Das ist keine gültige FEN.');
      return;
    }
    onBoardChange(parts[0]);
    onTurnChange(parts[1] === 'b' ? 'b' : 'w');
    setError('');
    setFenInput('');
  }

  function done() {
    const fen = buildFen(board, turn);
    const e = positionError(fen);
    if (e) {
      setError(e);
      return;
    }
    setError('');
    onDone(fen);
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

  return (
    <div className="game-screen editor">
      <div className="game-board-col">
        <div className="replay-head">
          <button className="icon-btn" onClick={onBack} aria-label="Zurück">
            ‹
          </button>
          <div>
            <strong>{title}</strong>
            <div className="muted small">{subtitle}</div>
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
          <button className="chip" onClick={() => onBoardChange(START_BOARD)}>
            Grundstellung
          </button>
          <button className="chip" onClick={() => onBoardChange('8/8/8/8/8/8/8/8')}>
            Leeres Brett
          </button>
        </div>
        <div className="field-row">
          <span>Am Zug:</span>
          <Segmented
            value={turn}
            onChange={onTurnChange}
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
        {extra}
        {error && <div className="bad">{error}</div>}
        <button className="btn primary big" onClick={done}>
          {doneLabel}
        </button>
      </div>
    </div>
  );
}
