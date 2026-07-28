import { useEffect, useRef, type RefObject } from 'react';

/**
 * Calls `onOutsideClick` when a pointerdown lands outside `ref`'s element,
 * but only while `active` — used to close a dropdown/menu on an outside
 * click without re-subscribing the listener on every render (the callback
 * is read from a ref so it doesn't need to be memoised by the caller).
 */
export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T>,
  active: boolean,
  onOutsideClick: () => void,
): void {
  const callbackRef = useRef(onOutsideClick);
  callbackRef.current = onOutsideClick;

  useEffect(() => {
    if (!active) return;
    const handler = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        callbackRef.current();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [active, ref]);
}
