import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { spring } from '@/theme/motion/tokens';
import { IconCheck } from '@/ui/meta/icons';

export type ToastTone = 'ok' | 'soft';
export type Notify = (text: string, tone?: ToastTone) => void;

interface Message {
  id: number;
  text: string;
  tone: ToastTone;
}

/** Petit message doux propre à la galerie (succès, erreurs sans reproche). */
export function useToast(): { notify: Notify; toast: ReactNode } {
  const [message, setMessage] = useState<Message | null>(null);
  const next = useRef(1);
  const notify = useCallback<Notify>((text, tone = 'ok') => {
    setMessage({ id: next.current++, text, tone });
  }, []);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => {
      setMessage(null);
    }, 3600);
    return () => {
      window.clearTimeout(timer);
    };
  }, [message]);
  const toast = createPortal(
    <div className="gg-toasts" role="status" aria-live="polite">
      <AnimatePresence>
        {message && (
          <motion.div
            key={message.id}
            className="gg-toast"
            data-tone={message.tone}
            initial={{ opacity: 0, y: 24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ type: 'spring', ...spring.snappy }}
            onClick={() => {
              setMessage(null);
            }}
          >
            {message.tone === 'ok' && (
              <span className="gg-toast__icon">
                <IconCheck size={16} />
              </span>
            )}
            <span>{message.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
  return { notify, toast };
}
