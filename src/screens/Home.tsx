import { useEffect, useRef, useState } from 'react';
import { countMyTurns } from './Online';
import { onlineServerHost } from '../lib/online';
import { Header } from '../components/ui';
import { getCurrent } from '../lib/games';
import { updateSettings, useSettings } from '../lib/settings';
import { exportAll, importAll } from '../lib/storage';
import { navigate } from '../router';

const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone =
  (navigator as Navigator & { standalone?: boolean }).standalone === true || matchMedia('(display-mode: standalone)').matches;

export function Home() {
  const current = getCurrent();
  const running = current && !current.result ? current : null;
  const [myTurns, setMyTurns] = useState(0);
  useEffect(() => {
    countMyTurns().then(setMyTurns).catch(() => undefined);
  }, []);
  return (
    <div className="screen home">
      <div className="hero">
        <div className="hero-icon">♞</div>
        <h1>SchachTrainer</h1>
      </div>
      <div className="content menu">
        {running && (
          <button className="menu-btn highlight" onClick={() => navigate('#/spiel')}>
            <span className="menu-icon">▶</span>
            <span>
              <strong>Partie fortsetzen</strong>
              <small>
                {running.white} – {running.black} · Zug {Math.floor(running.moves.length / 2) + 1}
              </small>
            </span>
          </button>
        )}
        <button className="menu-btn" onClick={() => navigate('#/zwei-spieler')}>
          <span className="menu-icon">♔♚</span>
          <span>
            <strong>2 Spieler</strong>
            <small>An einem Gerät – mit oder ohne Uhr</small>
          </span>
        </button>
        <button className="menu-btn" onClick={() => navigate('#/online')}>
          <span className="menu-icon">⇄</span>
          <span>
            <strong>Online mit Freunden</strong>
            <small>Live oder Fernschach – per Einladungscode</small>
          </span>
          {myTurns > 0 && <span className="badge">{myTurns} am Zug</span>}
        </button>
        <button className="menu-btn" onClick={() => navigate('#/raetsel')}>
          <span className="menu-icon">♟?</span>
          <span>
            <strong>Schachrätsel</strong>
            <small>Leicht, mittel, schwer und eigene Rätsel</small>
          </span>
        </button>
        <button className="menu-btn" onClick={() => navigate('#/computer')}>
          <span className="menu-icon">⚙</span>
          <span>
            <strong>Gegen Computer</strong>
            <small>8 Spielstärken, auch ab eigener Stellung</small>
          </span>
        </button>
        <div className="menu-row">
          <button className="menu-btn small" onClick={() => navigate('#/partien')}>
            <span className="menu-icon">☰</span>
            <strong>Partien</strong>
          </button>
          <button className="menu-btn small" onClick={() => navigate('#/einstellungen')}>
            <span className="menu-icon">⚒</span>
            <strong>Einstellungen</strong>
          </button>
        </div>
        {isIos && !isStandalone && (
          <div className="install-hint">
            <strong>Tipp für das iPhone/iPad:</strong> Tippe in Safari auf <b>Teilen</b> (□↑) und dann auf{' '}
            <b>„Zum Home-Bildschirm“</b>. Dann läuft die App im Vollbild, komplett offline, und deine Daten bleiben sicher
            gespeichert.
          </div>
        )}
      </div>
    </div>
  );
}

export function SettingsScreen() {
  const s = useSettings();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');

  const toggle = (label: string, key: keyof typeof s) => (
    <label className="toggle">
      <span>{label}</span>
      <input type="checkbox" checked={s[key]} onChange={(e) => updateSettings({ [key]: e.target.checked })} />
    </label>
  );

  async function backup() {
    const json = JSON.stringify({ app: 'SchachTrainer', version: 1, data: exportAll() });
    const name = `schachtrainer-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([json], name, { type: 'application/json' });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'SchachTrainer Sicherung' });
        return;
      }
    } catch {
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function restore(f: File) {
    try {
      const o = JSON.parse(await f.text());
      if (o.app !== 'SchachTrainer' || typeof o.data !== 'object') throw new Error();
      importAll(o.data);
      setMsg('Sicherung wiederhergestellt. Die App wird neu geladen …');
      setTimeout(() => location.reload(), 1200);
    } catch {
      setMsg('Die Datei ist keine gültige Sicherung.');
    }
  }

  return (
    <div className="screen">
      <Header title="Einstellungen" />
      <div className="content">
        <section className="card">
          {toggle('Töne', 'sound')}
          {toggle('Koordinaten anzeigen', 'coordinates')}
          {toggle('Mögliche Züge anzeigen', 'showDests')}
          {toggle('Animationen', 'animation')}
        </section>
        <section className="card">
          <h3>Datensicherung</h3>
          <p className="muted small">Partien, Rätsel-Fortschritt und eigene Rätsel als Datei sichern oder wiederherstellen.</p>
          <div className="row gap">
            <button className="btn" onClick={backup}>
              Sichern
            </button>
            <button className="btn" onClick={() => fileRef.current?.click()}>
              Wiederherstellen
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])}
            />
          </div>
          {msg && <div className="toast inline">{msg}</div>}
        </section>
        <section className="card small muted">
          <p>
            Rätsel: <a href="https://database.lichess.org/#puzzles">Lichess-Rätseldatenbank</a> (CC0). Engine: Stockfish (GPLv3).
            Brett: chessground (GPLv3), Figuren: cburnett (CC BY-SA 3.0).
          </p>
          <p>
            Version {__APP_VERSION__} · Online-Server: {onlineServerHost}
          </p>
        </section>
      </div>
    </div>
  );
}

declare const __APP_VERSION__: string;
