import { useState } from 'react';
import { Header, Segmented } from '../components/ui';
import { ENGINE_LEVELS, warmUpEngine } from '../lib/engine';
import { setCurrent, type GameRecord, type TimeControl, type ViewMode } from '../lib/games';
import { load, save, uid } from '../lib/storage';
import type { Color } from '../lib/chess';
import { navigate } from '../router';

const TIME_CONTROLS: { id: string; label: string; tc: TimeControl | null }[] = [
  { id: 'none', label: 'Ohne Uhr', tc: null },
  { id: '1+0', label: '1 min', tc: { initial: 60, inc: 0 } },
  { id: '3+2', label: '3 + 2', tc: { initial: 180, inc: 2 } },
  { id: '5+0', label: '5 min', tc: { initial: 300, inc: 0 } },
  { id: '10+0', label: '10 min', tc: { initial: 600, inc: 0 } },
  { id: '15+10', label: '15 + 10', tc: { initial: 900, inc: 10 } },
  { id: '30+0', label: '30 min', tc: { initial: 1800, inc: 0 } },
  { id: 'custom', label: 'Eigene', tc: null },
];

interface LocalPrefs {
  white: string;
  black: string;
  view: ViewMode;
  tcId: string;
  customMin: number;
  customInc: number;
}

export function LocalSetup() {
  const [p, setP] = useState<LocalPrefs>(() =>
    load<LocalPrefs>('local-prefs', { white: 'Weiß', black: 'Schwarz', view: 'pass', tcId: 'none', customMin: 10, customInc: 5 }),
  );
  const upd = (patch: Partial<LocalPrefs>) => setP((x) => ({ ...x, ...patch }));

  function start() {
    save('local-prefs', p);
    const tc =
      p.tcId === 'custom'
        ? { initial: Math.max(1, p.customMin) * 60, inc: Math.max(0, p.customInc) }
        : TIME_CONTROLS.find((t) => t.id === p.tcId)?.tc ?? null;
    const g: GameRecord = {
      id: uid(),
      mode: 'local',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      white: p.white.trim() || 'Weiß',
      black: p.black.trim() || 'Schwarz',
      moves: [],
      tc,
      clock: tc ? { w: tc.initial * 1000, b: tc.initial * 1000 } : undefined,
      view: p.view,
    };
    setCurrent(g);
    navigate('#/spiel');
  }

  return (
    <div className="screen">
      <Header title="2 Spieler" />
      <div className="content">
        <section className="card">
          <h3>Spieler</h3>
          <label className="field">
            <span>
              <span className="dot w" /> Weiß
            </span>
            <input value={p.white} maxLength={20} onChange={(e) => upd({ white: e.target.value })} />
          </label>
          <label className="field">
            <span>
              <span className="dot b" /> Schwarz
            </span>
            <input value={p.black} maxLength={20} onChange={(e) => upd({ black: e.target.value })} />
          </label>
          <button className="link-btn" onClick={() => upd({ white: p.black, black: p.white })}>
            ⇅ Farben tauschen
          </button>
        </section>

        <section className="card">
          <h3>Spielart</h3>
          <div className="choice-grid">
            <button className={'choice' + (p.view === 'pass' ? ' active' : '')} onClick={() => upd({ view: 'pass' })}>
              <strong>Weiterreichen</strong>
              <small>Das Brett dreht sich nach jedem Zug zum Spieler am Zug.</small>
            </button>
            <button className={'choice' + (p.view === 'table' ? ' active' : '')} onClick={() => upd({ view: 'table' })}>
              <strong>Tischmodus</strong>
              <small>Gerät liegt zwischen euch. Schwarz sieht Figuren und Uhr von seiner Seite.</small>
            </button>
          </div>
        </section>

        <section className="card">
          <h3>Bedenkzeit</h3>
          <div className="chip-grid">
            {TIME_CONTROLS.map((t) => (
              <button key={t.id} className={'chip' + (p.tcId === t.id ? ' active' : '')} onClick={() => upd({ tcId: t.id })}>
                {t.label}
              </button>
            ))}
          </div>
          {p.tcId === 'custom' && (
            <div className="row gap">
              <label className="field compact">
                <span>Minuten</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={180}
                  value={p.customMin}
                  onChange={(e) => upd({ customMin: Number(e.target.value) })}
                />
              </label>
              <label className="field compact">
                <span>+ Sek./Zug</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={60}
                  value={p.customInc}
                  onChange={(e) => upd({ customInc: Number(e.target.value) })}
                />
              </label>
            </div>
          )}
        </section>

        <button className="btn primary big" onClick={start}>
          Partie starten
        </button>
      </div>
    </div>
  );
}

interface EnginePrefs {
  level: number;
  color: Color | 'random';
}

export function EngineSetup() {
  const [p, setP] = useState<EnginePrefs>(() => load<EnginePrefs>('engine-prefs', { level: 2, color: 'w' }));
  warmUpEngine();

  function start() {
    save('engine-prefs', p);
    const human: Color = p.color === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : p.color;
    const cpu = `Computer (${p.level + 1})`;
    const g: GameRecord = {
      id: uid(),
      mode: 'engine',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      white: human === 'w' ? 'Du' : cpu,
      black: human === 'b' ? 'Du' : cpu,
      moves: [],
      tc: null,
      view: 'pass',
      engineLevel: p.level,
      humanColor: human,
    };
    setCurrent(g);
    navigate('#/spiel');
  }

  return (
    <div className="screen">
      <Header title="Gegen Computer" />
      <div className="content">
        <section className="card">
          <h3>Spielstärke</h3>
          <div className="level-list">
            {ENGINE_LEVELS.map((l, i) => (
              <button key={i} className={'chip wide' + (p.level === i ? ' active' : '')} onClick={() => setP({ ...p, level: i })}>
                {l.label}
              </button>
            ))}
          </div>
        </section>
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
        <button className="btn primary big" onClick={start}>
          Partie starten
        </button>
      </div>
    </div>
  );
}
