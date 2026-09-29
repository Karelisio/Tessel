import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { spring } from '@/theme/motion/tokens';
import { IconCheck } from '@/ui/meta/icons';

interface Message {
  id: number;
  text: string;
  tone: 'ok' | 'soft';
}

export type Notify = (text: string, tone?: 'ok' | 'soft') => void;

/** Petit message doux (succès, erreurs sans reproche), au-dessus de tout le reste. */
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
    }, 3400);
    return () => {
      window.clearTimeout(timer);
    };
  }, [message]);
  const toast = createPortal(
    <div className="cr-toasts" role="status" aria-live="polite">
      <AnimatePresence>
        {message && (
          <motion.div
            key={message.id}
            className="cr-toast"
            data-tone={message.tone}
            initial={{ opacity: 0, y: 22, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ type: 'spring', ...spring.snappy }}
            onClick={() => {
              setMessage(null);
            }}
          >
            {message.tone === 'ok' && (
              <span className="cr-toast__icon">
                <IconCheck size={15} />
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
