import { useSyncExternalStore } from 'react';
import { load, save } from './storage';

export interface Settings {
  sound: boolean;
  coordinates: boolean;
  showDests: boolean;
  animation: boolean;
}

const DEFAULTS: Settings = { sound: true, coordinates: true, showDests: true, animation: true };
let current: Settings = { ...DEFAULTS, ...load<Partial<Settings>>('settings', {}) };
const listeners = new Set<() => void>();

export function getSettings() {
  return current;
}

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch };
  save('settings', current);
  listeners.forEach((l) => l());
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}
