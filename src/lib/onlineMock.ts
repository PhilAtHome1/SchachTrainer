// Nur für Tests und Entwicklung (VITE_ONLINE_MOCK=1): bildet die Supabase-Funktionen aus
// supabase/schema.sql im Browser nach. Jeder Tab ist ein eigener Spieler; Tabs teilen sich
// die "Datenbank" über localStorage und werden per BroadcastChannel benachrichtigt.
import type { Backend, OnlineGame } from './online';

const DB = 'mock-online-db';
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function createMockBackend(): Backend {
  let uid = sessionStorage.getItem('mock-uid');
  if (!uid) {
    uid = crypto.randomUUID();
    sessionStorage.setItem('mock-uid', uid);
  }
  const me = uid;
  const channel = new BroadcastChannel('mock-online');
  const listeners = new Map<string, Set<(g: OnlineGame) => void>>();
  channel.onmessage = (ev) => {
    const g = ev.data as OnlineGame;
    listeners.get(g.id)?.forEach((l) => l(g));
  };

  const all = (): Record<string, OnlineGame> => JSON.parse(localStorage.getItem(DB) || '{}');
  const write = (g: OnlineGame) => {
    g.updated_at = new Date().toISOString();
    const db = all();
    db[g.id] = g;
    localStorage.setItem(DB, JSON.stringify(db));
    channel.postMessage(g);
    listeners.get(g.id)?.forEach((l) => l(g));
    return structuredClone(g);
  };
  const find = (id: string) => {
    const g = all()[id];
    if (!g) throw new Error('Partie nicht gefunden');
    return g;
  };
  const color = (g: OnlineGame) => (g.white_id === me ? 'w' : g.black_id === me ? 'b' : null);
  const turn = (g: OnlineGame) => (g.fen.split(' ')[1] === 'b' ? 'b' : 'w');
  const remaining = (g: OnlineGame) => {
    const base = (turn(g) === 'w' ? g.clock_w : g.clock_b) ?? 0;
    return g.moves.length === 0 ? base : base - (Date.now() - new Date(g.last_move_at!).getTime());
  };
  const finish = (g: OnlineGame, result: OnlineGame['result'], reason: string) =>
    write({ ...g, status: 'finished', result, reason, draw_offer: null });
  const delay = <T>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 50));

  return {
    init: () => delay(me),
    serverNow: () => delay(Date.now()),
    async create(mode, col, name, tcInitial, tcInc) {
      const c = col === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : col;
      const tc = mode === 'corr' ? null : tcInitial;
      const g: OnlineGame = {
        id: crypto.randomUUID(),
        code: Math.random().toString(36).slice(2, 8).toUpperCase(),
        mode,
        status: 'waiting',
        creator_id: me,
        white_id: c === 'w' ? me : null,
        black_id: c === 'b' ? me : null,
        white_name: c === 'w' ? name : null,
        black_name: c === 'b' ? name : null,
        start_fen: null,
        moves: [],
        fen: START,
        tc_initial: tc,
        tc_inc: tc == null ? null : tcInc ?? 0,
        clock_w: tc == null ? null : tc * 1000,
        clock_b: tc == null ? null : tc * 1000,
        last_move_at: null,
        draw_offer: null,
        result: null,
        reason: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return delay(write(g));
    },
    async join(code, name) {
      const g = Object.values(all()).find((x) => x.code === code.trim().toUpperCase());
      if (!g) throw new Error('Keine Partie mit diesem Code gefunden');
      if (color(g)) return delay(g);
      if (g.status !== 'waiting') throw new Error('Diese Partie hat bereits zwei Spieler');
      if (!g.white_id) Object.assign(g, { white_id: me, white_name: name });
      else Object.assign(g, { black_id: me, black_name: name });
      return delay(write({ ...g, status: 'active', last_move_at: new Date().toISOString() }));
    },
    get: async (id) => delay(all()[id] ?? null),
    list: async () =>
      delay(
        Object.values(all())
          .filter((g) => g.white_id === me || g.black_id === me || g.creator_id === me)
          .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
      ),
    async move(id, ply, san, fen, result, reason) {
      const g = find(id);
      if (g.status !== 'active') throw new Error('Die Partie läuft nicht');
      const mover = turn(g);
      if (color(g) !== mover) throw new Error('Du bist nicht am Zug');
      if (g.moves.length !== ply) throw new Error('Spielstand veraltet – bitte neu laden');
      if (g.tc_initial != null && g.moves.length > 0) {
        let left = remaining(g);
        if (left <= 0) return delay(finish(g, mover === 'w' ? '0-1' : '1-0', 'Zeitüberschreitung'));
        left += (g.tc_inc ?? 0) * 1000;
        if (mover === 'w') g.clock_w = left;
        else g.clock_b = left;
      }
      return delay(
        write({
          ...g,
          moves: [...g.moves, san],
          fen,
          last_move_at: new Date().toISOString(),
          draw_offer: g.draw_offer === mover ? g.draw_offer : null,
          status: result ? 'finished' : g.status,
          result: (result as OnlineGame['result']) ?? null,
          reason: reason ?? null,
        }),
      );
    },
    async resign(id) {
      const g = find(id);
      const c = color(g);
      if (!c || g.status !== 'active') throw new Error('Nicht möglich');
      return delay(finish(g, c === 'w' ? '0-1' : '1-0', c === 'w' ? 'Weiß gibt auf' : 'Schwarz gibt auf'));
    },
    async offerDraw(id) {
      const g = find(id);
      const c = color(g);
      if (!c || g.status !== 'active') throw new Error('Nicht möglich');
      return delay(write({ ...g, draw_offer: c }));
    },
    async answerDraw(id, accept) {
      const g = find(id);
      const c = color(g);
      if (!c || g.status !== 'active' || !g.draw_offer || g.draw_offer === c) throw new Error('Kein Remis-Angebot vorhanden');
      return delay(accept ? finish(g, '1/2-1/2', 'Remis vereinbart') : write({ ...g, draw_offer: null }));
    },
    async claimTimeout(id) {
      const g = find(id);
      if (g.status === 'active' && g.tc_initial != null && g.moves.length > 0 && remaining(g) <= 0)
        return delay(finish(g, turn(g) === 'w' ? '0-1' : '1-0', 'Zeitüberschreitung'));
      return delay(g);
    },
    async abort(id) {
      const g = find(id);
      if (g.creator_id !== me || g.status !== 'waiting') throw new Error('Nicht möglich');
      return delay(write({ ...g, status: 'aborted' }));
    },
    subscribe(id, onChange, onStatus) {
      const set = listeners.get(id) ?? new Set();
      set.add(onChange);
      listeners.set(id, set);
      onStatus?.(true);
      return () => set.delete(onChange);
    },
  };
}
