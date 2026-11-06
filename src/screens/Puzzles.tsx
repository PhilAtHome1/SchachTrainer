import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { Key } from '@lichess-org/chessground/types';
import type { DrawShape } from '@lichess-org/chessground/draw';
import { Board } from '../components/Board';
import { Dialog, Header, PromotionDialog } from '../components/ui';
import { cgColor, dests, isPromotion, opposite, parseUci, uciOf, type Color, type PromotionPiece } from '../lib/chess';
import {
  checkMove,
  customToPuzzle,
  decodePuzzle,
  deleteCustomPuzzle,
  encodePuzzle,
  getCustomPuzzles,
  getProgress,
  LEVELS,
  loadLevel,
  pickNext,
  recordAttempt,
  saveCustomPuzzle,
  themeNames,
  type Level,
  type Puzzle,
} from '../lib/puzzles';
import { playMoveSound, sounds } from '../lib/sound';
import { load, save } from '../lib/storage';
import { navigate } from '../router';

// ---------------- Übersicht ----------------

export function PuzzleHome() {
  const custom = getCustomPuzzles();
  const streak = load<number>('puzzle-streak', 0);
  return (
    <div className="screen">
      <Header title="Schachrätsel" />
      <div className="content">
        <p className="muted">Wähle einen Schwierigkeitsgrad. Rätsel aus der freien Lichess-Datenbank – 3.000 pro Stufe.</p>
        {LEVELS.map((l) => {
          const p = getProgress(l.id);
          const tried = p.solved.length + p.failed.length;
          return (
            <button key={l.id} className={`level-card level-${l.id}`} onClick={() => navigate(`#/raetsel/${l.id}`)}>
              <div>
                <strong>{l.name}</strong>
                <div className="small muted">{l.range}</div>
              </div>
              <div className="level-stats">
                <div>
                  <strong>{p.solved.length}</strong> gelöst
                </div>
                {tried > 0 && <div className="small muted">{Math.round((p.solved.length / tried) * 100)} % beim 1. Versuch</div>}
              </div>
            </button>
          );
        })}
        <button className="level-card level-custom" onClick={() => navigate('#/raetsel/eigene')}>
          <div>
            <strong>Eigene Rätsel</strong>
            <div className="small muted">Selbst erstellen, spielen und mit Freunden teilen</div>
          </div>
          <div className="level-stats">
            <strong>{custom.length}</strong>
          </div>
        </button>
        {streak > 1 && <p className="center muted">Aktuelle Serie: {streak} richtig in Folge 🔥</p>}
      </div>
    </div>
  );
}

// ---------------- Rätsel spielen ----------------

type Status = 'loading' | 'intro' | 'playing' | 'wrong' | 'solved' | 'shown';

export function PuzzlePlay({ source }: { source: { level: Level } | { customId: string } }) {
  const isCustom = 'customId' in source;
  const progressKey = isCustom ? 'eigene' : source.level;
  const [list, setList] = useState<Puzzle[] | null>(null);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [fen, setFen] = useState<string>('');
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<Status>('loading');
  const [lastMove, setLastMove] = useState<Key[] | undefined>();
  const [hint, setHint] = useState<DrawShape[]>([]);
  const [promo, setPromo] = useState<{ from: Key; to: Key } | null>(null);
  const [streak, setStreak] = useState(() => load<number>('puzzle-streak', 0));
  const [, force] = useState(0);
  const mistake = useRef(false);
  const recorded = useRef(false);
  const timers = useRef<number[]>([]);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  // Rätselliste laden
  useEffect(() => {
    if (isCustom) {
      const all = getCustomPuzzles().map(customToPuzzle);
      setList(all);
      const first = all.find((p) => p.id === source.customId) ?? all[0];
      if (first) start(first);
    } else {
      loadLevel(source.level).then((l) => {
        setList(l);
        start(pickNext(l, getProgress(source.level)));
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playerColor: Color = useMemo(() => {
    if (!puzzle) return 'w';
    const t = new Chess(puzzle.fen).turn();
    return puzzle.opponentStarts ? opposite(t) : t;
  }, [puzzle]);

  function start(p: Puzzle) {
    clearTimers();
    setPuzzle(p);
    setFen(p.fen);
    setLastMove(undefined);
    setHint([]);
    setStep(0);
    mistake.current = false;
    recorded.current = false;
    if (p.opponentStarts) {
      setStatus('intro');
      later(() => {
        const c = new Chess(p.fen);
        const m = c.move(parseUci(p.moves[0]));
        playMoveSound(m.san);
        setFen(c.fen());
        setLastMove([m.from as Key, m.to as Key]);
        setStep(1);
        setStatus('playing');
      }, 700);
    } else {
      setStatus('playing');
    }
  }

  function record(success: boolean) {
    if (recorded.current || !puzzle) return;
    recorded.current = true;
    recordAttempt(progressKey, puzzle.id, success);
    const s = success ? streak + 1 : 0;
    setStreak(s);
    save('puzzle-streak', s);
  }

  const onUserMove = useCallback(
    (from: Key, to: Key, promotion?: PromotionPiece) => {
      if (!puzzle || status !== 'playing') return;
      const c = new Chess(fen);
      let played;
      try {
        played = c.move({ from, to, promotion });
      } catch {
        return;
      }
      const uci = uciOf(played);
      const expected = puzzle.moves[step];
      setHint([]);
      setFen(c.fen());
      setLastMove([from, to]);
      if (!checkMove(fen, expected, uci)) {
        sounds.error();
        mistake.current = true;
        setStatus('wrong');
        later(() => {
          setFen(fen);
          setLastMove(undefined);
          setStatus('playing');
        }, 900);
        return;
      }
      playMoveSound(played.san);
      const nextStep = step + 1;
      if (nextStep >= puzzle.moves.length || c.isCheckmate()) {
        setStep(puzzle.moves.length);
        setStatus('solved');
        sounds.success();
        record(!mistake.current);
        return;
      }
      // Antwort des Gegners
      setStep(nextStep);
      later(() => {
        const reply = c.move(parseUci(puzzle.moves[nextStep]));
        playMoveSound(reply.san);
        setFen(c.fen());
        setLastMove([reply.from as Key, reply.to as Key]);
        const after = nextStep + 1;
        setStep(after);
        if (after >= puzzle.moves.length) {
          setStatus('solved');
          sounds.success();
          record(!mistake.current);
        }
      }, 450);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [puzzle, status, fen, step],
  );

  function showHint() {
    if (!puzzle || status !== 'playing') return;
    mistake.current = true;
    const m = parseUci(puzzle.moves[step]);
    setHint([{ orig: m.from as Key, brush: 'green' }]);
  }

  function showSolution() {
    if (!puzzle) return;
    clearTimers();
    mistake.current = true;
    record(false);
    setStatus('shown');
    setHint([]);
    const c = new Chess(fen);
    let i = step;
    const playNext = () => {
      if (i >= puzzle.moves.length) return;
      const m = c.move(parseUci(puzzle.moves[i]));
      playMoveSound(m.san);
      setFen(c.fen());
      setLastMove([m.from as Key, m.to as Key]);
      i++;
      setStep(i);
      later(playNext, 800);
    };
    playNext();
  }

  function next() {
    if (!list || !puzzle) return;
    if (isCustom) {
      const idx = list.findIndex((p) => p.id === puzzle.id);
      start(list[(idx + 1) % list.length]);
    } else {
      start(pickNext(list, getProgress(progressKey), puzzle.id));
    }
  }

  function retry() {
    if (puzzle) start(puzzle);
  }

  const chess = useMemo(() => (fen ? new Chess(fen) : null), [fen]);
  const turn = chess?.turn() ?? 'w';
  const canMove = status === 'playing' && turn === playerColor;
  const levelName = isCustom ? 'Eigene Rätsel' : LEVELS.find((l) => l.id === (source as { level: Level }).level)?.name;

  if (list && list.length === 0) {
    return (
      <div className="screen">
        <Header title={levelName ?? 'Rätsel'} back="#/raetsel" />
        <p className="muted center">Keine Rätsel vorhanden.</p>
      </div>
    );
  }

  let message: React.ReactNode;
  if (status === 'loading') message = 'Lade Rätsel …';
  else if (status === 'intro') message = 'Schau dir den Zug des Gegners an …';
  else if (status === 'playing')
    message = (
      <>
        <span className={`dot ${playerColor}`} /> {playerColor === 'w' ? 'Weiß' : 'Schwarz'} am Zug – finde den besten Zug!
      </>
    );
  else if (status === 'wrong') message = <span className="bad">✗ Das ist nicht der richtige Zug. Versuch es nochmal.</span>;
  else if (status === 'solved')
    message = <span className="good">✓ {mistake.current ? 'Gelöst (mit Hilfe)' : 'Richtig gelöst!'}</span>;
  else message = 'Lösung';

  const themes = status === 'solved' || status === 'shown' ? themeNames(puzzle?.themes) : [];

  return (
    <div className="game-screen puzzle">
      <div className="game-board-col">
        <div className="replay-head">
          <button className="icon-btn" onClick={() => navigate(isCustom ? '#/raetsel/eigene' : '#/raetsel')} aria-label="Zurück">
            ‹
          </button>
          <div>
            <strong>{puzzle?.name ?? levelName}</strong>
            <div className="muted small">
              {puzzle?.rating ? `Wertung ${puzzle.rating}` : puzzle?.custom ? LEVELS.find((l) => l.id === puzzle.level)?.name : ''}
              {streak > 1 ? ` · Serie ${streak} 🔥` : ''}
            </div>
          </div>
        </div>
        {chess && (
          <Board
            config={{
              fen,
              orientation: cgColor(playerColor),
              turnColor: cgColor(turn),
              lastMove,
              check: chess.inCheck() ? cgColor(turn) : false,
              movable: {
                free: false,
                color: canMove ? cgColor(playerColor) : undefined,
                dests: canMove ? dests(chess) : new Map(),
                events: {
                  after: (from: Key, to: Key) => {
                    if (isPromotion(new Chess(fen), from, to)) setPromo({ from, to });
                    else onUserMove(from, to);
                  },
                },
              },
              drawable: { autoShapes: hint },
            }}
          />
        )}
        {!chess && <div className="board-wrap placeholder" />}
      </div>
      <div className="game-side">
        <div className={'puzzle-msg ' + status}>{message}</div>
        {themes.length > 0 && <div className="themes">{themes.join(' · ')}</div>}
        <div className="toolbar">
          {(status === 'playing' || status === 'wrong') && (
            <>
              <button className="tool" onClick={showHint}>
                <span>💡</span>Hinweis
              </button>
              <button className="tool" onClick={showSolution}>
                <span>👁</span>Lösung
              </button>
            </>
          )}
          {(status === 'solved' || status === 'shown') && (
            <button className="tool" onClick={retry}>
              <span>↺</span>Nochmal
            </button>
          )}
          <button className={'tool' + (status === 'solved' || status === 'shown' ? ' primary' : '')} onClick={next}>
            <span>→</span>Nächstes
          </button>
        </div>
      </div>
      {promo && (
        <PromotionDialog
          color={playerColor}
          onSelect={(p) => {
            setPromo(null);
            onUserMove(promo.from, promo.to, p);
          }}
          onCancel={() => {
            setPromo(null);
            force((x) => x + 1); // Brett zurücksetzen
          }}
        />
      )}
    </div>
  );
}

// ---------------- Eigene Rätsel ----------------

export function CustomPuzzleList() {
  const [list, setList] = useState(getCustomPuzzles);
  const [importOpen, setImportOpen] = useState(false);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [toDelete, setToDelete] = useState<string | null>(null);

  async function share(id: string) {
    const p = list.find((x) => x.id === id);
    if (!p) return;
    const text = encodePuzzle(p);
    try {
      if (navigator.share) {
        await navigator.share({ title: `Schachrätsel: ${p.name}`, text });
        return;
      }
    } catch {
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setMsg('Code kopiert – schick ihn deinen Freunden.');
    } catch {
      setMsg(text);
    }
  }

  function doImport() {
    const p = decodePuzzle(code);
    if (!p) {
      setMsg('Ungültiger Code.');
      return;
    }
    saveCustomPuzzle(p);
    setList(getCustomPuzzles());
    setImportOpen(false);
    setCode('');
    setMsg(`„${p.name}“ importiert.`);
  }

  return (
    <div className="screen">
      <Header title="Eigene Rätsel" back="#/raetsel" />
      <div className="content">
        <div className="row gap">
          <button className="btn primary" onClick={() => navigate('#/raetsel/neu')}>
            + Neues Rätsel
          </button>
          <button className="btn" onClick={() => setImportOpen(true)}>
            Code einfügen
          </button>
        </div>
        {msg && <div className="toast inline">{msg}</div>}
        {list.length === 0 && <p className="muted center">Noch keine eigenen Rätsel. Erstelle eins oder importiere einen Code von Freunden.</p>}
        {list.map((p) => (
          <div key={p.id} className="list-item">
            <button className="list-main" onClick={() => navigate(`#/raetsel/eigene/${p.id}`)}>
              <strong>{p.name}</strong>
              <div className="muted small">
                {LEVELS.find((l) => l.id === p.level)?.name} · {Math.ceil(p.moves.length / 2)} Zug/Züge
              </div>
            </button>
            <button className="small-btn" onClick={() => share(p.id)} title="Teilen">
              ⇪
            </button>
            <button className="small-btn" onClick={() => setToDelete(p.id)} title="Löschen">
              🗑
            </button>
          </div>
        ))}
      </div>
      {importOpen && (
        <Dialog
          title="Rätsel importieren"
          buttons={[
            { label: 'Abbrechen', onClick: () => setImportOpen(false) },
            { label: 'Importieren', primary: true, onClick: doImport },
          ]}
        >
          <textarea className="code-input" placeholder="SCHACH:…" value={code} onChange={(e) => setCode(e.target.value)} rows={4} />
        </Dialog>
      )}
      {toDelete && (
        <Dialog
          title="Rätsel löschen?"
          buttons={[
            { label: 'Abbrechen', onClick: () => setToDelete(null) },
            {
              label: 'Löschen',
              danger: true,
              onClick: () => {
                deleteCustomPuzzle(toDelete);
                setList(getCustomPuzzles());
                setToDelete(null);
              },
            },
          ]}
        />
      )}
    </div>
  );
}
