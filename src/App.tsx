import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { useRoute } from './router';
import { Home, SettingsScreen } from './screens/Home';
import { EnginePosition, EngineSetup, LocalSetup } from './screens/Setup';
import { GameScreen } from './screens/GameScreen';
import { HistoryList, Replay } from './screens/History';
import { CustomPuzzleList, PuzzleHome, PuzzlePlay } from './screens/Puzzles';
import { PuzzleEditor } from './screens/PuzzleEditor';
import type { Level } from './lib/puzzles';

const LEVEL_IDS = ['leicht', 'mittel', 'schwer'];

function Screen({ route }: { route: string[] }) {
  const [a, b, c] = route;
  switch (a) {
    case 'zwei-spieler':
      return <LocalSetup />;
    case 'computer':
      return b === 'stellung' ? <EnginePosition /> : <EngineSetup />;
    case 'spiel':
      return <GameScreen />;
    case 'partien':
      return b ? <Replay id={b} /> : <HistoryList />;
    case 'einstellungen':
      return <SettingsScreen />;
    case 'raetsel':
      if (!b) return <PuzzleHome />;
      if (b === 'neu') return <PuzzleEditor />;
      if (b === 'eigene') return c ? <PuzzlePlay key={c} source={{ customId: c }} /> : <CustomPuzzleList />;
      if (LEVEL_IDS.includes(b)) return <PuzzlePlay key={b} source={{ level: b as Level }} />;
      return <PuzzleHome />;
    default:
      return <Home />;
  }
}

export function App() {
  const route = useRoute();
  const [update, setUpdate] = useState<null | (() => void)>(null);

  useEffect(() => {
    const updateSW = registerSW({
      onNeedRefresh: () => setUpdate(() => () => updateSW(true)),
    });
    // Speicher als "dauerhaft" markieren, damit der Browser ihn nicht aufräumt
    navigator.storage?.persist?.().catch(() => undefined);
  }, []);

  return (
    <>
      <Screen key={route.join('/')} route={route} />
      {update && (
        <div className="update-banner">
          Neue Version verfügbar
          <button className="btn primary" onClick={update}>
            Aktualisieren
          </button>
        </div>
      )}
    </>
  );
}
