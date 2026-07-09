import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MoMStatusBadge } from './MoMStatusBadge';
import type { MomStatus } from '../../types/api';

describe('MoMStatusBadge', () => {
  it('renders every MoM status', () => {
    const statuses: MomStatus[] = ['Action Pending', 'In Progress', 'Resolved', 'Deferred'];
    for (const s of statuses) {
      const { unmount } = render(<MoMStatusBadge status={s} />);
      expect(screen.getByText(s)).toBeInTheDocument();
      unmount();
    }
  });

  it('uses distinct tone classes for each status', () => {
    const { container: c1 } = render(<MoMStatusBadge status="Action Pending" />);
    const { container: c2 } = render(<MoMStatusBadge status="Resolved" />);
    expect(c1.firstElementChild?.className).toContain('bg-[#FEF3C7]');
    expect(c2.firstElementChild?.className).toContain('bg-[#DCFCE7]');
  });
});
