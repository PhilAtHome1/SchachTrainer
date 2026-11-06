// Kleine Hülle um localStorage. Auf dem iPhone bleibt der Speicher erhalten,
// solange die App über "Zum Home-Bildschirm" installiert ist.
const PREFIX = 'schach:';

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* Speicher voll oder gesperrt – ignorieren */
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignorieren */
  }
}

/** Alle App-Daten als Objekt (für die Datensicherung). */
export function exportAll(): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) data[k.slice(PREFIX.length)] = JSON.parse(localStorage.getItem(k)!);
    }
  } catch {
    /* ignorieren */
  }
  return data;
}

export function importAll(data: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(data)) save(k, v);
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
