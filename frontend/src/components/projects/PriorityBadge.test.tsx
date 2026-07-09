import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PriorityBadge } from './PriorityBadge';

describe('PriorityBadge', () => {
  it('renders High / Medium / Low / N/A', () => {
    for (const p of ['High', 'Medium', 'Low', 'N/A']) {
      const { unmount } = render(<PriorityBadge priority={p} />);
      expect(screen.getByText(p)).toBeInTheDocument();
      unmount();
    }
  });

  it('shows an em-dash when priority is null', () => {
    render(<PriorityBadge priority={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('colors High as danger, Low as success', () => {
    const { container: high } = render(<PriorityBadge priority="High" />);
    const { container: low } = render(<PriorityBadge priority="Low" />);
    expect(high.firstElementChild?.className).toContain('text-[#B91C1C]');
    expect(low.firstElementChild?.className).toContain('text-[#15803D]');
  });
});
