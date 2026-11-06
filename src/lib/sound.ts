import { getSettings } from './settings';

// Kurze, synthetisch erzeugte Klänge – keine Audiodateien nötig.
let ctx: AudioContext | null = null;

function tone(freq: number, duration: number, type: OscillatorType = 'triangle', gain = 0.15, delay = 0) {
  if (!getSettings().sound) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration);
  } catch {
    /* Audio nicht verfügbar */
  }
}

export const sounds = {
  move: () => tone(420, 0.08, 'triangle', 0.2),
  capture: () => {
    tone(300, 0.1, 'square', 0.08);
    tone(200, 0.12, 'triangle', 0.15, 0.03);
  },
  check: () => tone(660, 0.15, 'sine', 0.15),
  success: () => {
    tone(523, 0.12, 'sine', 0.15);
    tone(659, 0.12, 'sine', 0.15, 0.1);
    tone(784, 0.2, 'sine', 0.15, 0.2);
  },
  error: () => tone(160, 0.25, 'sawtooth', 0.08),
  end: () => {
    tone(392, 0.2, 'sine', 0.15);
    tone(523, 0.3, 'sine', 0.15, 0.18);
  },
};

export function playMoveSound(san: string) {
  if (san.includes('#')) sounds.end();
  else if (san.includes('+')) sounds.check();
  else if (san.includes('x')) sounds.capture();
  else sounds.move();
}

export function vibrate(ms = 15) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* iOS unterstützt keine Vibration im Browser */
  }
}
