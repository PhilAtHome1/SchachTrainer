import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { Key } from '@lichess-org/chessground/types';
import { Board } from '../components/Board';
import { Dialog, Header, MoveList, PromotionDialog, Segmented } from '../components/ui';
import {
  captured,
  cgColor,
  colorName,
  dests,
  isPromotion,
  lastMoveKeys,
  opposite,
  PIECE_SYMBOL,
  replay,
  type Color,
  type PromotionPiece,
} from '../lib/chess';
import { addToHistory, type GameRecord } from '../lib/games';
import {
  errorText,
  getBackend,
  getOnlineName,
  inviteText,
  isMyTurn,
  myColor,
  onlineConfigured,
  remainingMs,
  setOnlineName,
  turnOf,
  type Backend,
  type OnlineGame,
} from '../lib/online';
import { playMoveSound, sounds, vibrate } from '../lib/sound';
import { load, save } from '../lib/storage';
import { navigate } from '../router';
import { TIME_CONTROLS } from './Setup';

function useBackend() {
  const [state, setState] = useState<{ be: Backend; uid: string } | null>(null);
  const [error, setError] = useState('');
  const retry = useCallback(() => {
    setError('');
    getBackend()
      .then(async (be) => setState({ be, uid: await be.init() }))
      .catch((e) => setError(errorText(e)));
  }, []);
  useEffect(retry, [retry]);
  return { ...state, error, retry };
}

async function share(text: string, title: string): Promise<string> {
  try {
    if (navigator.share) {
      await navigator.share({ title, text });
      return '';
    }
  } catch {
    return '';
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'Einladung in die Zwischenablage kopiert.';
  } catch {
    return text;
  }
}

function NotConfigured() {
  return (
    <section className="card">
      <h3>Noch nicht eingerichtet</h3>
      <p className="small">
        Für Online-Partien braucht die App einen (kostenlosen) Supabase-Server. Die Einrichtung dauert etwa 5 Minuten und ist in
        der Datei <b>docs/ONLINE-EINRICHTUNG.md</b> im Repository beschrieben.
      </p>
    </section>
  );
}

// ---------------- Übersicht ----------------

export function OnlineHome({ joinCode }: { joinCode?: string }) {
  const { be, uid, error, retry } = useBackend();
  const [name, setName] = useState(getOnlineName);
  const [games, setGames] = useState<OnlineGame[] | null>(null);
  const [joinOpen, setJoinOpen] = useState(!!joinCode);
  const [code, setCode] = useState(joinCode ?? '');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    be?.list()
      .then(setGames)
      .catch((e) => setMsg(errorText(e)));
  }, [be]);
  useEffect(refresh, [refresh]);

  if (!onlineConfigured) {
    return (
      <div className="screen">
        <Header title="Online mit Freunden" />
        <div className="content">
          <NotConfigured />
        </div>
      </div>
    );
  }

  const needName = !name.trim();

  async function join() {
    if (needName || busy) return;
    if (code.trim().length < 6) {
      setMsg('Der Code hat 6 Zeichen.');
      return;
    }
    setBusy(true);
    try {
      const backend = be ?? (await getBackend()); // Verbindung evtl. noch im Aufbau
      await backend.init();
      const g = await backend.join(code, name.trim());
      setJoinOpen(false);
      navigate(`#/online/partie/${g.id}`);
    } catch (e) {
      setMsg(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const mine = (games ?? []).filter((g) => g.status !== 'aborted');
  const myTurn = mine.filter((g) => uid && isMyTurn(g, uid));
  const theirTurn = mine.filter((g) => g.status === 'active' && uid && !isMyTurn(g, uid));
  const waiting = mine.filter((g) => g.status === 'waiting');
  const finished = mine.filter((g) => g.status === 'finished').slice(0, 10);

  const item = (g: OnlineGame, note: string, highlight = false) => {
    const c = uid ? myColor(g, uid) : null;
    const opp = c === 'w' ? g.black_name : c === 'b' ? g.white_name : null;
    return (
      <button key={g.id} className={'list-item' + (highlight ? ' highlight' : '')} onClick={() => navigate(`#/online/partie/${g.id}`)}>
        <div>
          <strong>{opp ? `gegen ${opp}` : `Code ${g.code}`}</strong>
          <div className="muted small">
            {g.mode === 'corr' ? 'Fernschach' : g.tc_initial ? `Live ${g.tc_initial / 60}+${g.tc_inc ?? 0}` : 'Live ohne Uhr'} · {note}
          </div>
        </div>
        {g.status === 'finished' && (
          <div className="result-badge">{g.result === '1/2-1/2' ? '½–½' : g.result?.replace('-', '–')}</div>
        )}
      </button>
    );
  };

  return (
    <div className="screen">
      <Header
        title="Online mit Freunden"
        right={
          <button className="icon-btn small-icon" onClick={refresh} aria-label="Aktualisieren">
            ↻
          </button>
        }
      />
      <div className="content">
        {error && (
          <section className="card">
            <div className="bad">{error}</div>
            <button className="btn" onClick={retry}>
              Erneut versuchen
            </button>
          </section>
        )}
        <section className="card">
          <label className="field">
            <span>Dein Name (sehen deine Freunde)</span>
            <input
              value={name}
              maxLength={30}
              placeholder="z. B. Anna"
              onChange={(e) => {
                setName(e.target.value);
                setOnlineName(e.target.value);
              }}
            />
          </label>
          <div className="row gap">
            <button className="btn primary grow" disabled={!be || needName} onClick={() => navigate('#/online/neu')}>
              + Neue Partie
            </button>
            <button className="btn grow" disabled={!be || needName} onClick={() => setJoinOpen(true)}>
              Beitreten
            </button>
          </div>
          {needName && <div className="muted small">Bitte zuerst einen Namen eingeben.</div>}
        </section>
        {msg && <div className="toast inline">{msg}</div>}
        {games === null && !error && <p className="muted center">Lade Partien …</p>}
        {myTurn.length > 0 && <h3 className="list-title">Du bist am Zug</h3>}
        {myTurn.map((g) => item(g, 'Du bist am Zug', true))}
        {theirTurn.length > 0 && <h3 className="list-title">Gegner ist am Zug</h3>}
        {theirTurn.map((g) => item(g, `Zug ${Math.floor(g.moves.length / 2) + 1}`))}
        {waiting.length > 0 && <h3 className="list-title">Wartet auf Mitspieler</h3>}
        {waiting.map((g) => item(g, `Code ${g.code}`))}
        {finished.length > 0 && <h3 className="list-title">Beendet</h3>}
        {finished.map((g) => item(g, g.reason ?? ''))}
        {games !== null && mine.length === 0 && (
          <p className="muted center">Noch keine Online-Partien. Starte eine neue Partie und schick den Code an einen Freund.</p>
        )}
      </div>
      {joinOpen && (
        <Dialog
          title="Partie beitreten"
          buttons={[
            { label: 'Abbrechen', onClick: () => setJoinOpen(false) },
            { label: busy ? '…' : 'Beitreten', primary: true, onClick: join },
          ]}
        >
          <p className="small">Gib den 6-stelligen Code ein, den du bekommen hast.</p>
          <input
            className="code-field"
            value={code}
            maxLength={6}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="ABC123"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          {needName && <p className="bad small">Bitte zuerst oben deinen Namen eingeben.</p>}
          {msg && <p className="bad small">{msg}</p>}
        </Dialog>
      )}
    </div>
  );
}

// ---------------- Neue Partie ----------------

interface OnlinePrefs {
  mode: 'live' | 'corr';
  color: Color | 'random';
  tcId: string;
}

export function OnlineNew() {
  const { be, error } = useBackend();
  const [p, setP] = useState<OnlinePrefs>(() => load<OnlinePrefs>('online-prefs', { mode: 'live', color: 'random', tcId: '10+0' }));
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const tcs = TIME_CONTROLS.filter((t) => t.id !== 'custom');

  async function create() {
    if (!be) return;
    save('online-prefs', p);
    setBusy(true);
    try {
      const tc = p.mode === 'live' ? tcs.find((t) => t.id === p.tcId)?.tc ?? null : null;
      const g = await be.create(p.mode, p.color, getOnlineName() || 'Gast', tc?.initial ?? null, tc?.inc ?? null);
      navigate(`#/online/partie/${g.id}`, true);
    } catch (e) {
      setMsg(errorText(e));
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <Header title="Neue Online-Partie" back="#/online" />
      <div className="content">
        <section className="card">
          <h3>Spielart</h3>
          <div className="choice-grid">
            <button className={'choice' + (p.mode === 'live' ? ' active' : '')} onClick={() => setP({ ...p, mode: 'live' })}>
              <strong>Live</strong>
              <small>Ihr spielt gleichzeitig, optional mit Schachuhr.</small>
            </button>
            <button className={'choice' + (p.mode === 'corr' ? ' active' : '')} onClick={() => setP({ ...p, mode: 'corr' })}>
              <strong>Fernschach</strong>
              <small>Ohne Uhr – jeder zieht, wann er Zeit hat, auch über Tage.</small>
            </button>
          </div>
        </section>
        {p.mode === 'live' && (
          <section className="card">
            <h3>Bedenkzeit</h3>
            <div className="chip-grid">
              {tcs.map((t) => (
                <button key={t.id} className={'chip' + (p.tcId === t.id ? ' active' : '')} onClick={() => setP({ ...p, tcId: t.id })}>
                  {t.label}
                </button>
              ))}
            </div>
          </section>
        )}
        <section className="card">
          <h3>Deine Farbe</h3>
          <Segmented
            value={p.color}
            onChange={(color) => setP({ ...p, color })}
            options={[
              { value: 'w', label: 'Weiß' },
              { value: 'random', label: 'Zufall' },
              { value: 'b', label: 'Schwarz' },
            ]}
          />
        </section>
        {(msg || error) && <div className="bad">{msg || error}</div>}
        <button className="btn primary big" disabled={!be || busy} onClick={create}>
          {busy ? 'Erstelle …' : 'Partie erstellen'}
        </button>
      </div>
    </div>
  );
}

// ---------------- Partie ----------------

function formatClock(ms: number): string {
  const total = Math.max(0, ms);
  const s = Math.ceil(total / 1000);
  const m = Math.floor(s / 60);
  return total < 10_000 ? `0:0${Math.floor(total / 1000)}.${Math.floor((total % 1000) / 100)}` : `${m}:${String(s % 60).padStart(2, '0')}`;
}

function toRecord(g: OnlineGame, me: Color | null): GameRecord {
  return {
    id: `online-${g.id}`,
    mode: 'online',
    createdAt: new Date(g.created_at).getTime(),
    updatedAt: Date.now(),
    white: g.white_name ?? 'Weiß',
    black: g.black_name ?? 'Schwarz',
    startFen: g.start_fen ?? undefined,
    moves: g.moves,
    tc: g.tc_initial != null ? { initial: g.tc_initial, inc: g.tc_inc ?? 0 } : null,
    view: 'pass',
    humanColor: me ?? undefined,
    result: g.result ?? undefined,
    reason: g.reason ?? undefined,
  };
}

type Pending = { kind: 'promotion'; from: Key; to: Key } | { kind: 'resign' } | null;

export function OnlineGameScreen({ id }: { id: string }) {
  const { be, uid, error: initError } = useBackend();
  const [game, setGame] = useState<OnlineGame | null>(null);
  const [optimistic, setOptimistic] = useState<{ san: string; fen: string } | null>(null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [connected, setConnected] = useState(true);
  const [online, setOnline] = useState(navigator.onLine);
  const [msg, setMsg] = useState('');
  const [pending, setPending] = useState<Pending>(null);
  const [showEnd, setShowEnd] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const claimed = useRef('');
  const prevMoves = useRef<number | null>(null);

  // Neuere Stände übernehmen (Echtzeit-Updates können in beliebiger Reihenfolge kommen)
  const accept = useCallback((g: OnlineGame) => {
    setGame((cur) => {
      if (cur && cur.id === g.id && g.updated_at < cur.updated_at) return cur;
      return g;
    });
  }, []);

  const refresh = useCallback(() => {
    if (!be) return;
    be.get(id)
      .then((g) => {
        if (g) accept(g);
        else setNotFound(true);
      })
      .catch((e) => setMsg(errorText(e)));
    be.serverNow()
      .then((t) => setOffset(t - Date.now()))
      .catch(() => undefined);
  }, [be, id, accept]);

  useEffect(() => {
    if (!be) return;
    refresh();
    const unsub = be.subscribe(id, accept, setConnected);
    const onVis = () => !document.hidden && refresh();
    const onNet = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) refresh();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('online', onNet);
    window.addEventListener('offline', onNet);
    const poll = setInterval(refresh, 20_000); // Sicherheitsnetz, falls ein Echtzeit-Update verloren geht
    return () => {
      unsub();
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('online', onNet);
      window.removeEventListener('offline', onNet);
    };
  }, [be, id, refresh, accept]);

  const me: Color | null = game && uid ? myColor(game, uid) : null;
  const moves = useMemo(() => (game ? [...game.moves, ...(optimistic ? [optimistic.san] : [])] : []), [game, optimistic]);
  const chess = useMemo(() => {
    if (!game) return null;
    try {
      return replay(moves, game.start_fen ?? undefined);
    } catch {
      return null; // ungültiger Zug vom Gegner
    }
  }, [game, moves]);
  const turn: Color = chess?.turn() ?? 'w';
  const active = game?.status === 'active';
  const finished = game?.status === 'finished';
  const live = game?.tc_initial != null && active;

  // Ton bei neuem Zug des Gegners
  useEffect(() => {
    if (!game) return;
    if (prevMoves.current !== null && game.moves.length > prevMoves.current && turnOf(game) === me) {
      playMoveSound(game.moves[game.moves.length - 1]);
      vibrate(30);
    }
    prevMoves.current = game.moves.length;
  }, [game, me]);

  // Partie beendet → in die lokale Partiehistorie
  useEffect(() => {
    if (game && finished) addToHistory(toRecord(game, me));
  }, [game, finished, me]);

  // Uhr
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [live]);
  const serverNow = now + offset;
  const remaining = (c: Color) => (game ? remainingMs(game, c, serverNow) : null);

  // Zeitüberschreitung beim Server melden
  useEffect(() => {
    if (!be || !game || !live || game.moves.length === 0) return;
    const r = remaining(turnOf(game));
    if (r !== null && r <= 0 && claimed.current !== game.updated_at) {
      claimed.current = game.updated_at;
      be.claimTimeout(game.id).then(accept).catch(() => undefined);
    }
  });

  async function send(from: string, to: string, promotion?: PromotionPiece) {
    if (!be || !game || !chess || !me) return;
    const c = new Chess(chess.fen());
    let san: string;
    try {
      san = c.move({ from, to, promotion }).san;
    } catch {
      setGame({ ...game });
      return;
    }
    playMoveSound(san);
    vibrate();
    let result: OnlineGame['result'] = null;
    let reason: string | null = null;
    if (c.isCheckmate()) [result, reason] = [me === 'w' ? '1-0' : '0-1', 'Schachmatt'];
    else if (c.isStalemate()) [result, reason] = ['1/2-1/2', 'Patt'];
    else if (c.isInsufficientMaterial()) [result, reason] = ['1/2-1/2', 'Ungenügendes Material'];
    else if (c.isThreefoldRepetition()) [result, reason] = ['1/2-1/2', 'Dreifache Stellungswiederholung'];
    else if (c.isDrawByFiftyMoves()) [result, reason] = ['1/2-1/2', '50-Züge-Regel'];
    setOptimistic({ san, fen: c.fen() });
    try {
      const g = await be.move(game.id, game.moves.length, san, c.fen(), result, reason);
      accept(g);
      if (g.status === 'finished') {
        sounds.end();
        setShowEnd(true);
      }
    } catch (e) {
      setMsg(`Zug nicht übertragen: ${errorText(e)}`);
      refresh();
    } finally {
      setOptimistic(null);
    }
  }

  async function act(fn: () => Promise<OnlineGame>) {
    try {
      const g = await fn();
      accept(g);
      if (g.status === 'finished') setShowEnd(true);
    } catch (e) {
      setMsg(errorText(e));
    }
  }

  const config = useMemo(() => {
    if (!chess) return {};
    const canMove = active && !optimistic && me === turn && online;
    return {
      fen: chess.fen(),
      orientation: cgColor(me ?? 'w'),
      turnColor: cgColor(turn),
      lastMove: lastMoveKeys(chess),
      check: chess.inCheck() ? cgColor(turn) : false,

      movable: {
        free: false,
        color: canMove ? cgColor(me!) : undefined,
        dests: dests(chess),
        events: {
          after: (from: Key, to: Key) => {
            if (isPromotion(chess, from, to)) setPending({ kind: 'promotion', from, to });
            else void send(from, to);
          },
        },
      },
      premovable: { enabled: false },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chess, active, optimistic, me, turn, online]);

  if (!onlineConfigured) {
    return (
      <div className="screen">
        <Header title="Online" back="#/online" />
        <div className="content">
          <NotConfigured />
        </div>
      </div>
    );
  }
  if (notFound || initError) {
    return (
      <div className="screen">
        <Header title="Online-Partie" back="#/online" />
        <p className="bad center">{initError || 'Partie nicht gefunden.'}</p>
      </div>
    );
  }
  if (!game || !uid) {
    return (
      <div className="screen">
        <Header title="Online-Partie" back="#/online" />
        <p className="muted center">Lade Partie …</p>
      </div>
    );
  }

  const bottom = me ?? 'w';
  const top = opposite(bottom);
  const cap = chess ? captured(chess, game.start_fen ?? undefined) : null;
  const nameOf = (c: Color) => (c === 'w' ? game.white_name : game.black_name) ?? '…';

  const panel = (c: Color, pos: 'top' | 'bottom') => {
    const r = remaining(c);
    const isTurn = active && turn === c;
    return (
      <div className={`player-panel ${pos}` + (isTurn ? ' active' : '')}>
        <div className="player-info">
          <div className="player-name">
            <span className={`dot ${c}`} />
            {nameOf(c)}
            {c === me && <span className="muted small"> (du)</span>}
            {game.draw_offer === c && active && <span className="thinking">bietet Remis an</span>}
          </div>
          <div className="captured">
            {cap?.lost[opposite(c)].map((p, i) => <span key={i}>{PIECE_SYMBOL[p]}</span>)}
            {cap && (c === 'w' ? cap.diff : -cap.diff) > 0 && <span className="adv">+{Math.abs(cap.diff)}</span>}
          </div>
        </div>
        {r !== null && (
          <div className={'clock' + (isTurn && game.moves.length > 0 ? ' running' : '') + (r < 20_000 ? ' low' : '')}>
            {formatClock(r)}
          </div>
        )}
      </div>
    );
  };

  let status: React.ReactNode = null;
  if (!online || !connected) status = <div className="net-banner">⚠ Keine Verbindung zum Server – Züge werden erst übertragen, wenn du wieder online bist.</div>;
  else if (!chess) status = <div className="net-banner">⚠ Der Spielstand enthält einen ungültigen Zug.</div>;
  else if (active && me && turn !== me)
    status = (
      <div className="puzzle-msg">
        {game.mode === 'corr'
          ? `${nameOf(turn)} ist am Zug. Du kannst die App schließen – die Partie wartet auf dich.`
          : `Warte auf ${nameOf(turn)} …`}
      </div>
    );
  else if (active && me === turn) status = <div className="puzzle-msg good">Du bist am Zug</div>;

  let dialog: React.ReactNode = null;
  if (pending?.kind === 'promotion') {
    dialog = (
      <PromotionDialog
        color={turn}
        onSelect={(p) => {
          setPending(null);
          void send(pending.from, pending.to, p);
        }}
        onCancel={() => {
          setPending(null);
          setGame({ ...game });
        }}
      />
    );
  } else if (pending?.kind === 'resign') {
    dialog = (
      <Dialog
        title="Aufgeben?"
        buttons={[
          { label: 'Abbrechen', onClick: () => setPending(null) },
          {
            label: 'Aufgeben',
            danger: true,
            onClick: () => {
              setPending(null);
              void act(() => be!.resign(game.id));
            },
          },
        ]}
      >
        Willst du die Partie wirklich aufgeben?
      </Dialog>
    );
  } else if (game.status === 'waiting') {
    dialog = (
      <Dialog
        title="Warte auf Mitspieler"
        buttons={[
          ...(game.creator_id === uid
            ? [{ label: 'Partie löschen', danger: true, onClick: () => void act(() => be!.abort(game.id)).then(() => navigate('#/online', true)) }]
            : []),
          { label: 'Menü', onClick: () => navigate('#/online') },
          { label: 'Einladen', primary: true, onClick: () => void share(inviteText(game), 'Schach-Einladung').then(setMsg) },
        ]}
      >
        <p>Schick deinem Freund diesen Code:</p>
        <div className="big-code">{game.code}</div>
        <p className="small">Die Partie startet automatisch, sobald er beitritt.</p>
        {msg && <p className="small">{msg}</p>}
      </Dialog>
    );
  } else if (game.status === 'aborted') {
    dialog = <Dialog title="Partie gelöscht" buttons={[{ label: 'Zurück', primary: true, onClick: () => navigate('#/online') }]} />;
  } else if (active && game.draw_offer && game.draw_offer !== me && me) {
    dialog = (
      <Dialog
        title="Remis-Angebot"
        buttons={[
          { label: 'Ablehnen', onClick: () => void act(() => be!.answerDraw(game.id, false)) },
          { label: 'Annehmen', primary: true, onClick: () => void act(() => be!.answerDraw(game.id, true)) },
        ]}
      >
        {nameOf(game.draw_offer)} bietet Remis an.
      </Dialog>
    );
  } else if (finished && showEnd) {
    const won = (game.result === '1-0' && me === 'w') || (game.result === '0-1' && me === 'b');
    const title = game.result === '1/2-1/2' ? 'Remis' : won ? 'Gewonnen! 🎉' : me ? 'Verloren' : 'Partie beendet';
    dialog = (
      <Dialog
        title={title}
        buttons={[
          { label: 'Brett ansehen', onClick: () => setShowEnd(false) },
          { label: 'Neue Partie', primary: true, onClick: () => navigate('#/online/neu') },
        ]}
      >
        {game.reason}
      </Dialog>
    );
  }

  return (
    <div className="game-screen online">
      <div className="game-board-col">
        {panel(top, 'top')}
        {chess ? <Board config={config} /> : <div className="board-wrap placeholder" />}
        {panel(bottom, 'bottom')}
      </div>
      <div className="game-side">
        {status}
        {msg && game.status !== 'waiting' && (
          <div className="toast" onClick={() => setMsg('')}>
            {msg}
          </div>
        )}
        <MoveList moves={moves} startFen={game.start_fen ?? undefined} />
        <div className="toolbar">
          <button className="tool" onClick={() => navigate('#/online')}>
            <span>⌂</span>Übersicht
          </button>
          {active && me && (
            <button className="tool" disabled={game.draw_offer === me} onClick={() => void act(() => be!.offerDraw(game.id))}>
              <span>½</span>
              {game.draw_offer === me ? 'Angeboten' : 'Remis'}
            </button>
          )}
          {active && me && (
            <button className="tool" onClick={() => setPending({ kind: 'resign' })}>
              <span>⚑</span>Aufgeben
            </button>
          )}
          {finished && (
            <button className="tool" onClick={() => navigate(`#/partien/online-${game.id}`)}>
              <span>☰</span>Nachspielen
            </button>
          )}
        </div>
        {active && (
          <div className="muted small center">
            {game.mode === 'corr' ? 'Fernschach' : 'Live'} · Code {game.code} · {colorName(me ?? 'w')}
          </div>
        )}
      </div>
      {dialog}
    </div>
  );
}

/** Anzahl der Online-Partien, in denen ich am Zug bin (für die Startseite). */
export async function countMyTurns(): Promise<number> {
  if (!onlineConfigured) return 0;
  // Nur abfragen, wenn schon einmal online gespielt wurde (keine unnötige Anmeldung)
  const hasSession = load<unknown>('supabase-auth', null) !== null || !!sessionStorage.getItem('mock-uid');
  if (!hasSession) return 0;
  const be = await getBackend();
  const uid = await be.init();
  const list = await be.list();
  return list.filter((g) => isMyTurn(g, uid)).length;
}
