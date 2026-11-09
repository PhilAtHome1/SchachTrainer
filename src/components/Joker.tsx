import type { JokerHint } from '../lib/joker';

/** 💡-Knopf mit Zähler. `left = null` zeigt „∞“ (unbegrenzt). */
export function JokerButton({
  left,
  disabled,
  loading,
  onClick,
}: {
  left: number | null;
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={'small-btn joker' + (loading ? ' loading' : '')}
      disabled={disabled || left === 0}
      onClick={onClick}
      title="Joker: bester Zug von Stockfish"
    >
      💡<span className="joker-count">{left === null ? '∞' : left}</span>
    </button>
  );
}

/** Anzeige des vorgeschlagenen Zugs. */
export function JokerBanner({ hint, player, rotated }: { hint: JokerHint | null; player: string; rotated?: boolean }) {
  if (!hint) return null;
  return (
    <div className={'joker-msg' + (rotated ? ' rotated' : '')}>
      💡 Joker für {player}: <strong>{hint.san}</strong>
    </div>
  );
}
