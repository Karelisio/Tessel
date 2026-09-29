import { useReducedMotion, type Transition } from 'framer-motion';
import { useEffect, useState } from 'react';
import { duration, spring } from '@/theme/motion/tokens';

/** Transition de la charte de motion : ressort, ou fondu court si « Réduire les animations ». */
export function useSpringTransition(kind: keyof typeof spring = 'snappy'): Transition {
  const reduced = useReducedMotion();
  return reduced ? { duration: duration.xs / 1000 } : { type: 'spring', ...spring[kind] };
}

export interface Size {
  w: number;
  h: number;
}

/** Taille (px CSS) d'un élément, suivie par ResizeObserver. À brancher en `ref={setElement}`. */
export function useElementSize(): [(el: HTMLElement | null) => void, Size] {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [size, setSize] = useState<Size>({ w: 0, h: 0 });
  useEffect(() => {
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box) return;
      setSize((prev) =>
        prev.w === box.width && prev.h === box.height ? prev : { w: box.width, h: box.height },
      );
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [element]);
  return [setElement, size];
}
