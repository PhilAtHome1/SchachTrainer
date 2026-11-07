// Stockfish (WebAssembly, Single-Thread) läuft in einem Web Worker – komplett offline.

export const ENGINE_LEVELS = [
  { label: 'Stufe 1 – Anfänger', skill: 0, depth: 1 },
  { label: 'Stufe 2', skill: 2, depth: 2 },
  { label: 'Stufe 3', skill: 5, depth: 4 },
  { label: 'Stufe 4', skill: 8, depth: 6 },
  { label: 'Stufe 5', skill: 11, depth: 8 },
  { label: 'Stufe 6', skill: 14, depth: 10 },
  { label: 'Stufe 7', skill: 17, depth: 13 },
  { label: 'Stufe 8 – Meister', skill: 20, depth: 18 },
];

let worker: Worker | null = null;
let ready: Promise<void> | null = null;
let onLine: ((line: string) => void) | null = null;

function init(): Promise<void> {
  if (ready) return ready;
  ready = new Promise((resolve, reject) => {
    try {
      worker = new Worker(`${import.meta.env.BASE_URL}engine/stockfish-19-lite-single.js`);
    } catch (e) {
      reject(e);
      return;
    }
    worker.onmessage = (ev: MessageEvent) => {
      const line = String(ev.data);
      if (line === 'uciok') {
        worker!.postMessage('isready');
      } else if (line === 'readyok' && onLine === null) {
        resolve();
      }
      onLine?.(line);
    };
    worker.onerror = (e) => reject(e);
    worker.postMessage('uci');
  });
  ready.catch(() => {
    ready = null;
  });
  return ready;
}

let queue: Promise<unknown> = Promise.resolve();

function run(fen: string, skill: number, go: string): Promise<string> {
  const job = queue.then(async () => {
    await init();
    return new Promise<string>((resolve) => {
      onLine = (line) => {
        if (line.startsWith('bestmove')) {
          onLine = null;
          resolve(line.split(' ')[1]);
        }
      };
      const w = worker!;
      w.postMessage('ucinewgame');
      w.postMessage(`setoption name Skill Level value ${skill}`);
      w.postMessage(`position fen ${fen}`);
      w.postMessage(go);
    });
  });
  queue = job.catch(() => undefined);
  return job;
}

/** Liefert den Engine-Zug (UCI, z. B. "e2e4" oder "e7e8q") für eine Stellung. */
export function bestMove(fen: string, level: number): Promise<string> {
  const lv = ENGINE_LEVELS[Math.max(0, Math.min(ENGINE_LEVELS.length - 1, level))];
  return run(fen, lv.skill, `go depth ${lv.depth} movetime 3000`);
}

/** Bester Zug in voller Stärke (für den Joker). */
export function strongestMove(fen: string): Promise<string> {
  return run(fen, 20, 'go depth 18 movetime 2000');
}

export function warmUpEngine() {
  init().catch(() => undefined);
}
