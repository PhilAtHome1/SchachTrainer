import type { ReactNode } from 'react';
import { navigate } from '../router';
import type { Color, PromotionPiece } from '../lib/chess';

export function Header({ title, back = '#/', right }: { title: string; back?: string | null; right?: ReactNode }) {
  return (
    <header className="header">
      {back !== null ? (
        <button className="icon-btn" aria-label="Zurück" onClick={() => navigate(back)}>
          ‹
        </button>
      ) : (
        <span className="icon-btn-spacer" />
      )}
      <h1>{title}</h1>
      <div className="header-right">{right}</div>
    </header>
  );
}

export interface DialogButton {
  label: string;
  onClick: () => void;
  primary?: boolean;
  danger?: boolean;
}

export function Dialog({
  title,
  children,
  buttons,
  rotated,
}: {
  title?: string;
  children?: ReactNode;
  buttons: DialogButton[];
  rotated?: boolean;
}) {
  return (
    <div className="overlay">
      <div className={'dialog' + (rotated ? ' rotated' : '')} role="dialog">
        {title && <h2>{title}</h2>}
        {children && <div className="dialog-body">{children}</div>}
        <div className="dialog-buttons">
          {buttons.map((b) => (
            <button
              key={b.label}
              className={'btn' + (b.primary ? ' primary' : '') + (b.danger ? ' danger' : '')}
              onClick={b.onClick}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const PROMO: { p: PromotionPiece; name: string }[] = [
  { p: 'q', name: 'queen' },
  { p: 'r', name: 'rook' },
  { p: 'b', name: 'bishop' },
  { p: 'n', name: 'knight' },
];

export function PromotionDialog({
  color,
  rotated,
  onSelect,
  onCancel,
}: {
  color: Color;
  rotated?: boolean;
  onSelect: (p: PromotionPiece) => void;
  onCancel: () => void;
}) {
  const c = color === 'w' ? 'white' : 'black';
  return (
    <div className="overlay" onClick={onCancel}>
      <div className={'dialog promo' + (rotated ? ' rotated' : '')} onClick={(e) => e.stopPropagation()}>
        <h2>Umwandeln in</h2>
        <div className="promo-row cg-wrap">
          {PROMO.map(({ p, name }) => (
            <button key={p} className="promo-btn" onClick={() => onSelect(p)} aria-label={name}>
              <piece className={`${name} ${c}`} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={String(o.value)} className={o.value === value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function MoveList({
  moves,
  current,
  onSelect,
  startFen,
}: {
  moves: string[];
  current?: number; // Anzahl gespielter Halbzüge, die angezeigt werden
  onSelect?: (ply: number) => void;
  startFen?: string;
}) {
  // Startet die Partie aus einer Stellung mit Schwarz am Zug, beginnt die Liste mit "n…"
  const parts = startFen?.split(' ') ?? [];
  const offset = parts[1] === 'b' ? 1 : 0;
  const firstNo = Number(parts[5]) || 1;
  const rows: ReactNode[] = [];
  const total = moves.length + offset;
  for (let v = 0; v < total; v += 2) {
    const cell = (vi: number) => {
      const ply = vi - offset;
      return ply >= 0 && ply < moves.length ? (
        <span
          key={vi}
          className={'mv' + (current === ply + 1 ? ' current' : '')}
          onClick={onSelect ? () => onSelect(ply + 1) : undefined}
        >
          {moves[ply]}
        </span>
      ) : (
        <span key={vi} className="mv">
          {ply < 0 ? '…' : ''}
        </span>
      );
    };
    rows.push(
      <div className="mv-row" key={v}>
        <span className="mv-no">{firstNo + v / 2}.</span>
        {cell(v)}
        {cell(v + 1)}
      </div>,
    );
  }
  return (
    <div
      className="movelist"
      ref={(el) => {
        if (!el) return;
        const cur = el.querySelector('.current') as HTMLElement | null;
        if (cur) cur.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        else el.scrollTop = el.scrollHeight;
      }}
    >
      {rows.length ? rows : <div className="muted small">Noch keine Züge</div>}
    </div>
  );
}

declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      piece: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}
