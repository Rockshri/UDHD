import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('renders every known status', () => {
    for (const s of ['In Progress', 'Completed', 'Not Started', 'Delayed', 'On Hold']) {
      const { unmount } = render(<StatusBadge status={s} />);
      expect(screen.getByText(s)).toBeInTheDocument();
      unmount();
    }
  });

  it('falls back to Not Started when the value is null', () => {
    render(<StatusBadge status={null} />);
    expect(screen.getByText('Not Started')).toBeInTheDocument();
  });

  it('applies a distinct color per status', () => {
    const { container: c1 } = render(<StatusBadge status="Completed" />);
    const { container: c2 } = render(<StatusBadge status="Delayed" />);
    expect(c1.firstElementChild?.className).toContain('text-[#15803D]');
    expect(c2.firstElementChild?.className).toContain('text-[#6D28D9]');
  });

  it('accepts an unknown status without crashing', () => {
    render(<StatusBadge status="Something Weird" />);
    expect(screen.getByText('Something Weird')).toBeInTheDocument();
  });
});
