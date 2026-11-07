import { useMemo, useState } from 'react';
import { Board } from '../components/Board';
import { Dialog, Header, MoveList } from '../components/ui';
import { cgColor, lastMoveKeys, replay } from '../lib/chess';
import { deleteFromHistory, getHistory, resultText, toPgn } from '../lib/games';
import { navigate } from '../router';
import { getEnginePrefs, startEngineGame } from './Setup';

function formatDate(ts: number) {
  return new Date(ts).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
}

export function HistoryList() {
  const [list] = useState(getHistory);
  return (
    <div className="screen">
      <Header title="Partien" />
      <div className="content">
        {list.length === 0 && <p className="muted center">Noch keine beendeten Partien.</p>}
        {list.map((g) => (
          <button key={g.id} className="list-item" onClick={() => navigate(`#/partien/${g.id}`)}>
            <div>
              <strong>
                {g.white} – {g.black}
              </strong>
              <div className="muted small">
                {formatDate(g.createdAt)} · {Math.ceil(g.moves.length / 2)} Züge
                {g.tc ? ` · ${g.tc.initial / 60}+${g.tc.inc}` : ''}
              </div>
            </div>
            <div className="result-badge">{g.result === '1/2-1/2' ? '½–½' : g.result?.replace('-', '–')}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function Replay({ id }: { id: string }) {
  const game = useMemo(() => getHistory().find((g) => g.id === id), [id]);
  const [ply, setPly] = useState(game?.moves.length ?? 0);
  const [flip, setFlip] = useState(game?.mode === 'engine' && game.humanColor === 'b');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [msg, setMsg] = useState('');

  const chess = useMemo(() => (game ? replay(game.moves.slice(0, ply), game.startFen) : null), [game, ply]);
  if (!game || !chess) {
    return (
      <div className="screen">
        <Header title="Partie" back="#/partien" />
        <p className="muted center">Partie nicht gefunden.</p>
      </div>
    );
  }

  async function share() {
    const pgn = toPgn(game!);
    try {
      if (navigator.share) {
        await navigator.share({ title: `${game!.white} – ${game!.black}`, text: pgn });
        return;
      }
    } catch {
      return; // abgebrochen
    }
    try {
      await navigator.clipboard.writeText(pgn);
      setMsg('PGN in die Zwischenablage kopiert');
    } catch {
      setMsg('Kopieren nicht möglich');
    }
  }

  const n = game.moves.length;
  return (
    <div className="game-screen replay">
      <div className="game-board-col">
        <div className="replay-head">
          <button className="icon-btn" onClick={() => navigate('#/partien')} aria-label="Zurück">
            ‹
          </button>
          <div>
            <strong>
              {game.white} – {game.black}
            </strong>
            <div className="muted small">
              {resultText(game)}
              {game.reason ? ` · ${game.reason}` : ''}
            </div>
          </div>
        </div>
        <Board
          config={{
            fen: chess.fen(),
            orientation: flip ? 'black' : 'white',
            lastMove: lastMoveKeys(chess),
            check: chess.inCheck() ? cgColor(chess.turn()) : false,
            viewOnly: true,
          }}
        />
        <div className="nav-row">
          <button className="tool" onClick={() => setPly(0)} disabled={ply === 0}>
            ⏮
          </button>
          <button className="tool" onClick={() => setPly(Math.max(0, ply - 1))} disabled={ply === 0}>
            ◀
          </button>
          <button className="tool" onClick={() => setPly(Math.min(n, ply + 1))} disabled={ply === n}>
            ▶
          </button>
          <button className="tool" onClick={() => setPly(n)} disabled={ply === n}>
            ⏭
          </button>
        </div>
      </div>
      <div className="game-side">
        <MoveList moves={game.moves} current={ply} onSelect={setPly} startFen={game.startFen} />
        {msg && <div className="toast">{msg}</div>}
        <div className="toolbar">
          <button className="tool" onClick={() => setFlip(!flip)}>
            <span>⇅</span>Drehen
          </button>
          <button className="tool" onClick={share}>
            <span>⇪</span>PGN
          </button>
          <button
            className="tool"
            disabled={chess.isGameOver()}
            onClick={() => startEngineGame(getEnginePrefs(), chess.fen(), chess.turn())}
          >
            <span>⚙</span>Ab hier vs. PC
          </button>
          <button className="tool" onClick={() => setConfirmDelete(true)}>
            <span>🗑</span>Löschen
          </button>
        </div>
      </div>
      {confirmDelete && (
        <Dialog
          title="Partie löschen?"
          buttons={[
            { label: 'Abbrechen', onClick: () => setConfirmDelete(false) },
            {
              label: 'Löschen',
              danger: true,
              onClick: () => {
                deleteFromHistory(game.id);
                navigate('#/partien', true);
              },
            },
          ]}
        />
      )}
    </div>
  );
}
