import { useEffect, useState } from 'react';
import type { Engine } from '@/engine/Engine';

/** Affichage des performances (fps, temps de frame, temps de travail), rafraîchi 4 fois par seconde. */
export function PerfHud({ engine }: { engine: Engine }) {
  const [text, setText] = useState('');
  useEffect(() => {
    const id = setInterval(() => {
      const s = engine.perf.stats();
      const r = engine.app.renderer;
      setText(
        [
          `${s.fps.toFixed(0)} fps  (p95 ${s.frameP95.toFixed(1)} ms)`,
          `travail ${s.workAvg.toFixed(2)} ms  p95 ${s.workP95.toFixed(2)}`,
          `saccades ${s.janky}/240  rendus ${s.rendered}`,
          `${r.width}×${r.height} @${r.resolution.toFixed(2)}  case ${engine.camera.scale.toFixed(1)}px`,
        ].join('\n'),
      );
    }, 250);
    return () => {
      clearInterval(id);
    };
  }, [engine]);
  return <div className="hud">{text}</div>;
}
