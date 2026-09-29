import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { tr } from '@/i18n/locale';
import type { ToolId } from '@/meta/rewards';
import { useMetaStore } from '@/store/meta';
import { spring } from '@/theme/motion/tokens';
import { IconBucket, IconLoupe, IconWand } from './icons';
import { TOOL_HINTS, TOOL_NAMES } from './labels';

const ICONS: Record<ToolId, ReactNode> = {
  loupe: <IconLoupe size={22} />,
  bucket: <IconBucket size={22} />,
  wand: <IconWand size={22} />,
};

interface Props {
  armed: ToolId | null;
  disabled: boolean;
  onUse: (tool: ToolId) => void;
}

/** Outils gagnés en jouant : loupe, pot de peinture (s'arme), baguette. */
export function ToolDock({ armed, disabled, onUse }: Props) {
  const tools = useMetaStore((s) => s.snap?.tools);
  if (!tools) return null;
  return (
    <div className="tool-dock" role="toolbar" aria-label="Outils">
      {(['loupe', 'bucket', 'wand'] as const).map((tool) => {
        const count = tools[tool];
        const active = armed === tool;
        return (
          <motion.button
            key={tool}
            className="tool"
            aria-label={`${tr(TOOL_NAMES[tool])} (${count}) — ${tr(TOOL_HINTS[tool])}`}
            aria-pressed={active}
            data-empty={count === 0}
            disabled={disabled}
            whileTap={{ scale: 0.86 }}
            animate={{ scale: active ? 1.08 : 1, y: active ? -2 : 0 }}
            transition={{ type: 'spring', ...spring.bouncy }}
            onClick={() => {
              onUse(tool);
            }}
          >
            {active && (
              <motion.span
                className="tool__halo"
                initial={{ opacity: 0.7, scale: 1 }}
                animate={{ opacity: 0, scale: 1.6 }}
                transition={{ duration: 1.1, repeat: Infinity, ease: 'easeOut' }}
              />
            )}
            {ICONS[tool]}
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={count}
                className="tool__count"
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.3, opacity: 0 }}
                transition={{ type: 'spring', ...spring.bouncy }}
              >
                {count}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        );
      })}
    </div>
  );
}
