import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';
import { api } from '../../app/api';
import { authReducer } from '../../features/auth/authSlice';
import { MilestonesSection } from './MilestonesSection';

function makeStore() {
  return configureStore({
    reducer: { [api.reducerPath]: api.reducer, auth: authReducer },
    middleware: (getDefault) => getDefault().concat(api.middleware),
  });
}

describe('MilestonesSection', () => {
  it('renders the "save first" guard when projectId is null', () => {
    const store = makeStore();
    render(
      <Provider store={store}>
        <MilestonesSection projectId={null} />
      </Provider>,
    );
    expect(screen.getByText(/save the project first/i)).toBeInTheDocument();
  });
});
