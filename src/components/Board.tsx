import { useEffect, useRef } from 'react';
import { Chessground } from '@lichess-org/chessground';
import type { Api } from '@lichess-org/chessground/api';
import type { Config } from '@lichess-org/chessground/config';
import { useSettings } from '../lib/settings';

interface Props {
  config: Config;
  apiRef?: React.MutableRefObject<Api | null>;
  className?: string;
}

/** Dünne React-Hülle um chessground (das Brett von Lichess). */
export function Board({ config, apiRef, className }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const settings = useSettings();

  const full: Config = {
    coordinates: settings.coordinates,
    animation: { enabled: settings.animation, duration: 200 },
    ...config,
    movable: { showDests: settings.showDests, ...config.movable },
    highlight: { lastMove: true, check: true, ...config.highlight },
    draggable: { showGhost: true, ...config.draggable },
  };

  useEffect(() => {
    api.current = Chessground(el.current!, { ...full, disableContextMenu: true });
    if (apiRef) apiRef.current = api.current;
    return () => {
      api.current?.destroy();
      api.current = null;
      if (apiRef) apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    api.current?.set(full);
  });

  return (
    <div className={'board-wrap ' + (className ?? '')}>
      <div ref={el} className="board" />
    </div>
  );
}
