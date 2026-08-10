import { renderHook } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useClickOutside } from './useClickOutside';

function fireMouseDown(target: EventTarget): void {
  const event = new MouseEvent('mousedown', { bubbles: true });
  Object.defineProperty(event, 'target', { value: target });
  document.dispatchEvent(event);
}

describe('useClickOutside', () => {
  it('calls the callback when the click lands outside the ref element', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const outsideEl = document.createElement('span');
    document.body.appendChild(outsideEl);
    const ref = createRef<HTMLDivElement>();
    (ref as { current: HTMLDivElement }).current = el;
    const onOutsideClick = vi.fn();

    renderHook(() => useClickOutside(ref, true, onOutsideClick));
    fireMouseDown(outsideEl);

    expect(onOutsideClick).toHaveBeenCalledTimes(1);
    document.body.removeChild(el);
    document.body.removeChild(outsideEl);
  });

  it('does not call the callback when the click lands inside the ref element', () => {
    const el = document.createElement('div');
    const inner = document.createElement('span');
    el.appendChild(inner);
    document.body.appendChild(el);
    const ref = createRef<HTMLDivElement>();
    (ref as { current: HTMLDivElement }).current = el;
    const onOutsideClick = vi.fn();

    renderHook(() => useClickOutside(ref, true, onOutsideClick));
    fireMouseDown(inner);

    expect(onOutsideClick).not.toHaveBeenCalled();
    document.body.removeChild(el);
  });

  it('does nothing while inactive', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const outsideEl = document.createElement('span');
    document.body.appendChild(outsideEl);
    const ref = createRef<HTMLDivElement>();
    (ref as { current: HTMLDivElement }).current = el;
    const onOutsideClick = vi.fn();

    renderHook(() => useClickOutside(ref, false, onOutsideClick));
    fireMouseDown(outsideEl);

    expect(onOutsideClick).not.toHaveBeenCalled();
    document.body.removeChild(el);
    document.body.removeChild(outsideEl);
  });
});
