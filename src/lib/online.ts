// Online-Partien mit Freunden über Supabase (Datenbank + Echtzeit + anonyme Anmeldung).
// Konfiguration beim Build über VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY.
import { load, save } from './storage';
import type { Color } from './chess';

export interface OnlineGame {
  id: string;
  code: string;
  mode: 'live' | 'corr';
  status: 'waiting' | 'active' | 'finished' | 'aborted';
  creator_id: string;
  white_id: string | null;
  black_id: string | null;
  white_name: string | null;
  black_name: string | null;
  start_fen: string | null;
  moves: string[];
  fen: string;
  tc_initial: number | null;
  tc_inc: number | null;
  clock_w: number | null;
  clock_b: number | null;
  last_move_at: string | null;
  draw_offer: Color | null;
  result: '1-0' | '0-1' | '1/2-1/2' | null;
  reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface Backend {
  /** Meldet (anonym) an und liefert die eigene Benutzer-ID. */
  init(): Promise<string>;
  serverNow(): Promise<number>;
  create(mode: 'live' | 'corr', color: Color | 'random', name: string, tcInitial: number | null, tcInc: number | null): Promise<OnlineGame>;
  join(code: string, name: string): Promise<OnlineGame>;
  get(id: string): Promise<OnlineGame | null>;
  list(): Promise<OnlineGame[]>;
  move(id: string, ply: number, san: string, fen: string, result?: string | null, reason?: string | null): Promise<OnlineGame>;
  resign(id: string): Promise<OnlineGame>;
  offerDraw(id: string): Promise<OnlineGame>;
  answerDraw(id: string, accept: boolean): Promise<OnlineGame>;
  claimTimeout(id: string): Promise<OnlineGame>;
  abort(id: string): Promise<OnlineGame>;
  /** Meldet Änderungen an der Partie; liefert eine Funktion zum Abmelden. */
  subscribe(id: string, onChange: (g: OnlineGame) => void, onStatus?: (connected: boolean) => void): () => void;
}

/**
 * Bereinigt die eingetragene Projekt-Adresse: Leerzeichen und Anführungszeichen weg,
 * fehlendes https:// ergänzen und nur den Ursprung behalten. So funktionieren auch
 * Varianten wie "https://xyz.supabase.co/rest/v1/" oder "xyz.supabase.co/".
 */
export function normalizeSupabaseUrl(raw: string | undefined): string | undefined {
  let v = (raw ?? '').trim().replace(/^['"]|['"]$/g, '').trim();
  if (!v) return undefined;
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
  try {
    return new globalThis.URL(v).origin;
  } catch {
    return undefined;
  }
}

export function normalizeKey(raw: string | undefined): string | undefined {
  const v = (raw ?? '').trim().replace(/^['"]|['"]$/g, '').trim();
  return v || undefined;
}

const URL = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL as string | undefined);
const KEY = normalizeKey(import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);

/** Für die Anzeige in den Einstellungen (Fehlersuche). */
export const onlineServerHost = serverHost();
function serverHost(): string {
  if (import.meta.env.VITE_ONLINE_MOCK === '1') return 'Testserver (lokal)';
  return URL ? new globalThis.URL(URL).host : 'nicht eingerichtet';
}
const MOCK = import.meta.env.VITE_ONLINE_MOCK === '1';

export const onlineConfigured = MOCK || !!(URL && KEY);

let backend: Promise<Backend> | null = null;

export function getBackend(): Promise<Backend> {
  if (!backend) {
    backend = (MOCK ? import('./onlineMock').then((m) => m.createMockBackend()) : createSupabaseBackend()).catch((e) => {
      backend = null;
      throw e;
    });
  }
  return backend;
}

async function createSupabaseBackend(): Promise<Backend> {
  if (!URL || !KEY) throw new Error('Online ist nicht eingerichtet.');
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(URL, KEY, {
    auth: { storageKey: 'schach:supabase-auth', persistSession: true, autoRefreshToken: true },
  });

  const rpc = async <T>(fn: string, args: Record<string, unknown>): Promise<T> => {
    const { data, error } = await sb.rpc(fn, args);
    if (error) throw new Error(error.message);
    return data as T;
  };

  return {
    async init() {
      const { data } = await sb.auth.getSession();
      if (data.session) return data.session.user.id;
      const res = await sb.auth.signInAnonymously();
      if (res.error || !res.data.user) throw new Error(res.error?.message ?? 'Anmeldung fehlgeschlagen');
      return res.data.user.id;
    },
    async serverNow() {
      const t = await rpc<string>('server_now', {});
      return new Date(t).getTime();
    },
    create: (mode, color, name, tcInitial, tcInc) =>
      rpc('create_game', { p_mode: mode, p_color: color, p_name: name, p_tc_initial: tcInitial, p_tc_inc: tcInc }),
    join: (code, name) => rpc('join_game', { p_code: code, p_name: name }),
    async get(id) {
      const { data, error } = await sb.from('games').select('*').eq('id', id).maybeSingle();
      if (error) throw new Error(error.message);
      return data as OnlineGame | null;
    },
    async list() {
      const { data, error } = await sb.from('games').select('*').order('updated_at', { ascending: false }).limit(50);
      if (error) throw new Error(error.message);
      return (data ?? []) as OnlineGame[];
    },
    move: (id, ply, san, fen, result, reason) =>
      rpc('make_move', { p_id: id, p_ply: ply, p_san: san, p_fen: fen, p_result: result ?? null, p_reason: reason ?? null }),
    resign: (id) => rpc('resign_game', { p_id: id }),
    offerDraw: (id) => rpc('offer_draw', { p_id: id }),
    answerDraw: (id, accept) => rpc('answer_draw', { p_id: id, p_accept: accept }),
    claimTimeout: (id) => rpc('claim_timeout', { p_id: id }),
    abort: (id) => rpc('abort_game', { p_id: id }),
    subscribe(id, onChange, onStatus) {
      const channel = sb
        .channel(`game-${id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${id}` }, (payload) =>
          onChange(payload.new as OnlineGame),
        )
        .subscribe((status) => onStatus?.(status === 'SUBSCRIBED'));
      return () => {
        void sb.removeChannel(channel);
      };
    },
  };
}

// ---------- Hilfen für die Oberfläche ----------

export const getOnlineName = () => load<string>('online-name', '');
export const setOnlineName = (n: string) => save('online-name', n.trim().slice(0, 30));

export function myColor(g: OnlineGame, uid: string): Color | null {
  if (g.white_id === uid) return 'w';
  if (g.black_id === uid) return 'b';
  return null;
}

export const turnOf = (g: OnlineGame): Color => (g.fen.split(' ')[1] === 'b' ? 'b' : 'w');

export function isMyTurn(g: OnlineGame, uid: string): boolean {
  return g.status === 'active' && myColor(g, uid) === turnOf(g);
}

/** Verbleibende Zeit (ms) einer Farbe zum Zeitpunkt `now` (Serverzeit). */
export function remainingMs(g: OnlineGame, c: Color, now: number): number | null {
  if (g.tc_initial == null) return null;
  // Wer auf Zeit verloren hat, hat 0 – auch bei Partien, die mit der alten
  // Server-Version beendet wurden (dort blieb die Uhr auf dem Stand vor dem Zug stehen).
  if (g.status === 'finished' && g.reason?.startsWith('Zeitüberschreitung')) {
    const loser: Color = g.result === '1-0' ? 'b' : 'w';
    if (c === loser) return 0;
  }
  const base = (c === 'w' ? g.clock_w : g.clock_b) ?? 0;
  const running = g.status === 'active' && turnOf(g) === c && g.moves.length > 0 && g.last_move_at;
  return running ? base - (now - new Date(g.last_move_at!).getTime()) : base;
}

export function inviteText(g: OnlineGame): string {
  const url = location.href.split('#')[0];
  return (
    `Spiel Schach mit mir! Öffne die SchachTrainer-App, tippe auf „Online mit Freunden“ → „Beitreten“ und gib den Code ${g.code} ein.\n` +
    `App: ${url}`
  );
}

/** Freundliche Fehlermeldung (Netzwerk, Server). */
export function errorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (!navigator.onLine || /Failed to fetch|NetworkError|Load failed/i.test(msg)) return 'Keine Internetverbindung.';
  if (/anonymous/i.test(msg)) return 'Anonyme Anmeldung ist im Supabase-Projekt nicht aktiviert.';
  if (/invalid path|requested path is invalid/i.test(msg))
    return 'Die Server-Adresse ist ungültig. In SUPABASE_URL gehört nur die Project URL (z. B. https://abcd.supabase.co).';
  if (/could not find the function|schema cache|relation .*games.* does not exist/i.test(msg))
    return 'Die Datenbank ist noch nicht eingerichtet: supabase/schema.sql im SQL Editor ausführen.';
  if (/invalid api key|no api key|jwt/i.test(msg)) return 'Der Supabase-Key ist ungültig. SUPABASE_ANON_KEY prüfen.';
  return msg;
}
