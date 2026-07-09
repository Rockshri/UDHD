import { act, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { useProjectFilters } from './useProjectFilters';

function withRouter(initial: string) {
  return function Wrapper({ children }: { children: React.ReactNode }): JSX.Element {
    return <MemoryRouter initialEntries={[initial]}>{children}</MemoryRouter>;
  };
}

describe('useProjectFilters', () => {
  it('reads initial filters from the URL', () => {
    const { result } = renderHook(() => useProjectFilters(), {
      wrapper: withRouter('/projects?status=Delayed&sectorId=2'),
    });
    expect(result.current.filters.status).toBe('Delayed');
    expect(result.current.filters.sectorId).toBe('2');
    expect(result.current.activeCount).toBe(2);
  });

  it('defaults to empty strings for missing filters', () => {
    const { result } = renderHook(() => useProjectFilters(), {
      wrapper: withRouter('/projects'),
    });
    expect(result.current.filters.status).toBe('');
    expect(result.current.filters.search).toBe('');
    expect(result.current.activeCount).toBe(0);
  });

  it('setFilter updates the URL', () => {
    const { result } = renderHook(() => useProjectFilters(), {
      wrapper: withRouter('/projects'),
    });
    act(() => result.current.setFilter('status', 'Completed'));
    expect(result.current.filters.status).toBe('Completed');
    expect(result.current.activeCount).toBe(1);
  });

  it('setFilter with empty string removes the key', () => {
    const { result } = renderHook(() => useProjectFilters(), {
      wrapper: withRouter('/projects?status=Delayed'),
    });
    act(() => result.current.setFilter('status', ''));
    expect(result.current.filters.status).toBe('');
    expect(result.current.activeCount).toBe(0);
  });

  it('clearAll wipes every filter', () => {
    const { result } = renderHook(() => useProjectFilters(), {
      wrapper: withRouter('/projects?status=Delayed&sectorId=2&search=foo'),
    });
    expect(result.current.activeCount).toBe(3);
    act(() => result.current.clearAll());
    expect(result.current.activeCount).toBe(0);
  });
});
