import { useAnimationControls } from 'framer-motion';
import { useCallback } from 'react';

/** Petit tremblement horizontal (élément verrouillé touché). */
export function useShake() {
  const controls = useAnimationControls();
  const shake = useCallback(() => {
    void controls.start({ x: [0, -7, 7, -5, 5, -2, 0], transition: { duration: 0.42 } });
  }, [controls]);
  return { controls, shake };
}
