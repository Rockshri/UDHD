import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { StatCard } from './StatCard';

describe('StatCard', () => {
  it('renders label and value', () => {
    render(
      <MemoryRouter>
        <StatCard label="Total Projects" value="298" />
      </MemoryRouter>,
    );
    expect(screen.getByText('Total Projects')).toBeInTheDocument();
    expect(screen.getByText('298')).toBeInTheDocument();
  });

  it('renders as a link when `to` is provided', () => {
    render(
      <MemoryRouter>
        <StatCard label="Delayed" value="12" to="/projects?status=Delayed" tone="danger" />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: 'Delayed' });
    expect(link).toHaveAttribute('href', '/projects?status=Delayed');
  });

  it('renders as a plain div when `to` is omitted', () => {
    render(
      <MemoryRouter>
        <StatCard label="On Hold" value="0" />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('renders the icon slot when provided', () => {
    render(
      <MemoryRouter>
        <StatCard label="Total" value="0" icon="📊" />
      </MemoryRouter>,
    );
    expect(screen.getByText('📊')).toBeInTheDocument();
  });

  it('renders hint text when provided', () => {
    render(
      <MemoryRouter>
        <StatCard label="Completed" value="112" hint="37.6% of total" />
      </MemoryRouter>,
    );
    expect(screen.getByText('37.6% of total')).toBeInTheDocument();
  });

  it('applies a distinct tone class on the border', () => {
    const { container } = render(
      <MemoryRouter>
        <StatCard label="Delayed" value="12" tone="danger" />
      </MemoryRouter>,
    );
    expect(container.firstElementChild?.className).toContain('border-l-[#B91C1C]');
  });
});
