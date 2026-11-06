import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Key } from '@lichess-org/chessground/types';
import { Board } from '../components/Board';
import { Dialog, MoveList, PromotionDialog, type DialogButton } from '../components/ui';
import {
  canMate,
  captured,
  cgColor,
  colorName,
  dests,
  isPromotion,
  lastMoveKeys,
  opposite,
  parseUci,
  PIECE_SYMBOL,
  replay,
  type Color,
  type PromotionPiece,
} from '../lib/chess';
import {
  addToHistory,
  getCurrent,
  resultText,
  setCurrent,
  type GameRecord,
  type Result,
} from '../lib/games';
import { bestMove } from '../lib/engine';
import { playMoveSound, sounds, vibrate } from '../lib/sound';
import { uid } from '../lib/storage';
import { navigate } from '../router';

function formatClock(ms: number): string {
  const total = Math.max(0, ms);
  if (total < 10_000) {
    const s = Math.floor(total / 1000);
    const t = Math.floor((total % 1000) / 100);
    return `0:0${s}.${t}`;
  }
  const s = Math.ceil(total / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

type Pending =
  | { kind: 'promotion'; from: Key; to: Key }
  | { kind: 'draw-offer'; by: Color }
  | { kind: 'resign'; by: Color }
  | { kind: 'undo' }
  | null;

export function GameScreen() {
  const [game, setGame] = useState<GameRecord | null>(() => getCurrent());
  const [pending, setPending] = useState<Pending>(null);
  const [now, setNow] = useState(() => Date.now());
  const [paused, setPaused] = useState(false);
  const [showEnd, setShowEnd] = useState(true);
  const [thinking, setThinking] = useState(false);
  const turnStart = useRef<number>(Date.now());
  const engineToken = useRef(0);

  useEffect(() => {
    if (!game) navigate('#/', true);
  }, [game]);

  const chess = useMemo(() => (game ? replay(game.moves, game.startFen) : null), [game?.moves, game?.startFen]);
  const turn: Color = chess?.turn() ?? 'w';
  const over = !!game?.result;
  const clockRunning = !!game?.tc && !!game.clock && game.moves.length > 0 && !over && !paused;

  // Uhr: Anzeige aktualisieren
  useEffect(() => {
    if (!clockRunning) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [clockRunning]);

  // Beim Verlassen der App (Home-Button, Sperrbildschirm) automatisch pausieren
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && clockRunning) pause();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  });

  const remaining = (c: Color): number | null => {
    if (!game?.tc || !game.clock) return null;
    const base = game.clock[c];
    return clockRunning && c === turn ? base - (now - turnStart.current) : base;
  };

  const persist = useCallback((g: GameRecord) => {
    g.updatedAt = Date.now();
    setCurrent(g);
    if (g.result) addToHistory(g);
    setGame(g);
  }, []);

  const finish = useCallback(
    (g: GameRecord, result: Result, reason: string) => {
      sounds.end();
      setShowEnd(true);
      persist({ ...g, result, reason });
    },
    [persist],
  );

  // Zeitüberschreitung
  useEffect(() => {
    if (!game || !clockRunning) return;
    const r = remaining(turn);
    if (r !== null && r <= 0) {
      const clock = { ...game.clock!, [turn]: 0 };
      const winner = opposite(turn);
      if (!canMate(chess!, winner)) finish({ ...game, clock }, '1/2-1/2', 'Zeitüberschreitung – ungenügendes Material');
      else finish({ ...game, clock }, winner === 'w' ? '1-0' : '0-1', `Zeitüberschreitung (${colorName(turn)})`);
    }
  });

  function pause() {
    if (!game || !clockRunning) return;
    const clock = { ...game.clock!, [turn]: game.clock![turn] - (Date.now() - turnStart.current) };
    setPaused(true);
    persist({ ...game, clock });
  }

  function resume() {
    turnStart.current = Date.now();
    setNow(Date.now());
    setPaused(false);
  }

  const applyMove = useCallback(
    (from: string, to: string, promotion?: PromotionPiece) => {
      if (!game || game.result) return;
      const c = replay(game.moves, game.startFen);
      let san: string;
      try {
        san = c.move({ from, to, promotion }).san;
      } catch {
        setGame({ ...game }); // Brett zurücksetzen
        return;
      }
      playMoveSound(san);
      vibrate();
      const mover = opposite(c.turn());
      let clock = game.clock;
      if (game.tc && clock) {
        const t = Date.now();
        const used = game.moves.length > 0 && !paused ? t - turnStart.current : 0;
        clock = { ...clock, [mover]: clock[mover] - used + (game.moves.length > 0 ? game.tc.inc * 1000 : 0) };
        turnStart.current = t;
        setNow(t);
      }
      const next: GameRecord = { ...game, moves: [...game.moves, san], clock };
      setPaused(false);
      if (c.isCheckmate()) finish(next, mover === 'w' ? '1-0' : '0-1', 'Schachmatt');
      else if (c.isStalemate()) finish(next, '1/2-1/2', 'Patt');
      else if (c.isInsufficientMaterial()) finish(next, '1/2-1/2', 'Ungenügendes Material');
      else if (c.isThreefoldRepetition()) finish(next, '1/2-1/2', 'Dreifache Stellungswiederholung');
      else if (c.isDrawByFiftyMoves()) finish(next, '1/2-1/2', '50-Züge-Regel');
      else persist(next);
    },
    [game, paused, finish, persist],
  );

  // Computerzug
  const engineTurn = !!game && game.mode === 'engine' && !over && turn !== game.humanColor;
  useEffect(() => {
    if (!engineTurn || !chess || !game) return;
    const token = ++engineToken.current;
    setThinking(true);
    const started = Date.now();
    bestMove(chess.fen(), game.engineLevel ?? 3)
      .then((uci) => {
        const wait = Math.max(0, 400 - (Date.now() - started));
        setTimeout(() => {
          if (token !== engineToken.current) return;
          setThinking(false);
          const m = parseUci(uci);
          applyMove(m.from, m.to, m.promotion);
        }, wait);
      })
      .catch(() => {
        if (token === engineToken.current) setThinking(false);
      });
    return () => {
      engineToken.current++;
      setThinking(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineTurn, game?.moves.length]);

  // Brettausrichtung: im Weiterreichen-Modus dreht sich das Brett zum Spieler am Zug
  const [orientation, setOrientation] = useState<Color>(() =>
    game?.mode === 'engine' ? game.humanColor ?? 'w' : game?.view === 'pass' ? turn : 'w',
  );
  useEffect(() => {
    if (!game) return;
    if (game.mode === 'engine') setOrientation(game.humanColor ?? 'w');
    else if (game.view === 'table') setOrientation('w');
    else if (!over) {
      const t = setTimeout(() => setOrientation(turn), 450);
      return () => clearTimeout(t);
    }
  }, [turn, game?.view, game?.mode, over]);

  const tableMode = game?.mode === 'local' && game.view === 'table';

  const config = useMemo(() => {
    if (!chess || !game) return {};
    const humanTurn = game.mode === 'local' || turn === game.humanColor;
    return {
      fen: chess.fen(),
      orientation: cgColor(orientation),
      turnColor: cgColor(turn),
      lastMove: lastMoveKeys(chess),
      check: chess.inCheck() ? cgColor(turn) : false,
      viewOnly: over,
      movable: {
        free: false,
        color: !over && humanTurn && !paused ? cgColor(turn) : undefined,
        dests: dests(chess),
        events: {
          after: (from: Key, to: Key) => {
            if (isPromotion(chess, from, to)) setPending({ kind: 'promotion', from, to });
            else applyMove(from, to);
          },
        },
      },
      premovable: { enabled: false },
    };
  }, [chess, game, orientation, turn, over, paused, applyMove]);

  if (!game || !chess) return null;

  const cap = captured(chess);

  function undo() {
    if (!game || game.moves.length === 0) return;
    engineToken.current++;
    let n = 1;
    if (game.mode === 'engine') {
      // eigenen Zug und Antwort des Computers zurücknehmen
      n = turn === game.humanColor ? 2 : 1;
    }
    const moves = game.moves.slice(0, Math.max(0, game.moves.length - n));
    turnStart.current = Date.now();
    persist({ ...game, moves, result: undefined, reason: undefined });
    setPending(null);
  }

  function newGame(swap: boolean) {
    if (!game) return;
    const g: GameRecord = {
      ...game,
      id: uid(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      moves: [],
      result: undefined,
      reason: undefined,
      white: swap && game.mode === 'local' ? game.black : game.white,
      black: swap && game.mode === 'local' ? game.white : game.black,
      clock: game.tc ? { w: game.tc.initial * 1000, b: game.tc.initial * 1000 } : undefined,
    };
    if (game.mode === 'engine' && swap) {
      g.humanColor = opposite(game.humanColor ?? 'w');
      const human = game.humanColor === 'w' ? game.white : game.black;
      const cpu = game.humanColor === 'w' ? game.black : game.white;
      g.white = g.humanColor === 'w' ? human : cpu;
      g.black = g.humanColor === 'w' ? cpu : human;
    }
    setPaused(false);
    persist(g);
  }

  const name = (c: Color) => (c === 'w' ? game.white : game.black);

  const panel = (c: Color, position: 'top' | 'bottom') => {
    const r = remaining(c);
    const active = !over && turn === c;
    const rotated = tableMode && position === 'top';
    const showActions = !over && (game.mode === 'local' || c === game.humanColor);
    return (
      <div className={`player-panel ${position}` + (active ? ' active' : '') + (rotated ? ' rotated' : '')}>
        <div className="player-info">
          <div className="player-name">
            <span className={`dot ${c}`} />
            {name(c)}
            {game.mode === 'engine' && c !== game.humanColor && thinking && <span className="thinking">denkt …</span>}
          </div>
          <div className="captured">
            {cap.lost[opposite(c)].map((p, i) => (
              <span key={i}>{PIECE_SYMBOL[p]}</span>
            ))}
            {(c === 'w' ? cap.diff : -cap.diff) > 0 && <span className="adv">+{Math.abs(cap.diff)}</span>}
          </div>
        </div>
        {showActions && (
          <div className="player-actions">
            {game.mode === 'local' && (
              <button className="small-btn" onClick={() => setPending({ kind: 'draw-offer', by: c })} title="Remis anbieten">
                ½
              </button>
            )}
            <button className="small-btn" onClick={() => setPending({ kind: 'resign', by: c })} title="Aufgeben">
              ⚑
            </button>
          </div>
        )}
        {r !== null && (
          <div className={'clock' + (active && clockRunning ? ' running' : '') + (r < 20_000 ? ' low' : '')}>
            {formatClock(r)}
          </div>
        )}
      </div>
    );
  };

  const topColor = opposite(orientation);
  const bottomColor = orientation;

  let dialog: React.ReactNode = null;
  if (pending?.kind === 'promotion') {
    dialog = (
      <PromotionDialog
        color={turn}
        rotated={tableMode && turn === 'b'}
        onSelect={(p) => {
          setPending(null);
          applyMove(pending.from, pending.to, p);
        }}
        onCancel={() => {
          setPending(null);
          setGame({ ...game });
        }}
      />
    );
  } else if (pending?.kind === 'draw-offer') {
    const to = opposite(pending.by);
    dialog = (
      <Dialog
        title="Remis-Angebot"
        rotated={tableMode && to === 'b'}
        buttons={[
          { label: 'Ablehnen', onClick: () => setPending(null) },
          {
            label: 'Annehmen',
            primary: true,
            onClick: () => {
              setPending(null);
              finish(game, '1/2-1/2', 'Remis vereinbart');
            },
          },
        ]}
      >
        {name(pending.by)} bietet Remis an. {name(to)}, nimmst du an?
      </Dialog>
    );
  } else if (pending?.kind === 'resign') {
    const by = pending.by;
    dialog = (
      <Dialog
        title="Aufgeben?"
        rotated={tableMode && by === 'b'}
        buttons={[
          { label: 'Abbrechen', onClick: () => setPending(null) },
          {
            label: 'Aufgeben',
            danger: true,
            onClick: () => {
              setPending(null);
              finish(game, by === 'w' ? '0-1' : '1-0', `${colorName(by)} gibt auf`);
            },
          },
        ]}
      >
        {name(by)}, willst du die Partie wirklich aufgeben?
      </Dialog>
    );
  } else if (pending?.kind === 'undo') {
    dialog = (
      <Dialog
        title="Zug zurücknehmen?"
        buttons={[
          { label: 'Abbrechen', onClick: () => setPending(null) },
          { label: 'Zurücknehmen', primary: true, onClick: undo },
        ]}
      >
        Der letzte Zug wird zurückgenommen.
      </Dialog>
    );
  } else if (over && showEnd) {
    const buttons: DialogButton[] = [
      { label: 'Brett ansehen', onClick: () => setShowEnd(false) },
      { label: 'Revanche', primary: true, onClick: () => newGame(true) },
      { label: 'Menü', onClick: () => navigate('#/') },
    ];
    dialog = (
      <Dialog title={resultText(game)} buttons={buttons}>
        {game.reason}
      </Dialog>
    );
  }

  return (
    <div className={'game-screen' + (tableMode ? ' table-mode' : '')}>
      <div className="game-board-col">
        {panel(topColor, 'top')}
        <Board config={config} />
        {panel(bottomColor, 'bottom')}
      </div>
      <div className="game-side">
        <MoveList moves={game.moves} />
        <div className="toolbar">
          <button className="tool" onClick={() => navigate('#/')}>
            <span>⌂</span>Menü
          </button>
          {!over && (
            <button className="tool" disabled={game.moves.length === 0} onClick={() => setPending({ kind: 'undo' })}>
              <span>↶</span>Zurück
            </button>
          )}
          {!over && game.tc && (
            <button className="tool" disabled={game.moves.length === 0} onClick={() => (paused ? resume() : pause())}>
              <span>{paused ? '▶' : '❚❚'}</span>
              {paused ? 'Weiter' : 'Pause'}
            </button>
          )}
          {over && (
            <button className="tool" onClick={() => navigate(`#/partien/${game.id}`)}>
              <span>☰</span>Nachspielen
            </button>
          )}
          {over && (
            <button className="tool" onClick={() => newGame(true)}>
              <span>↻</span>Revanche
            </button>
          )}
        </div>
      </div>
      {paused && !pending && (
        <Dialog title="Pause" buttons={[{ label: 'Weiterspielen', primary: true, onClick: resume }]}>
          Die Uhr ist angehalten.
        </Dialog>
      )}
      {dialog}
    </div>
  );
}
