import { configureStore, type ThunkAction, type Action } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { api } from './api';
import { authReducer } from '../features/auth/authSlice';

/* Endpoint modules register themselves on `api` via injectEndpoints. */
import '../app/api/authApi';
import '../app/api/lookupsApi';
import '../app/api/kpisApi';
import '../app/api/projectsApi';
import '../app/api/cosEotApi';
import '../app/api/mgmtActionsApi';
import '../app/api/milestonesApi';
import '../app/api/momApi';
import '../app/api/preMonsoonApi';
import '../app/api/geoPhotosApi';
import '../app/api/usersApi';
import '../app/api/auditApi';

export function makeStore(): ReturnType<typeof configureStore<{
  auth: ReturnType<typeof authReducer>;
  api: ReturnType<typeof api.reducer>;
}>> {
  const store = configureStore({
    reducer: {
      auth: authReducer,
      [api.reducerPath]: api.reducer,
    },
    middleware: (getDefault) => getDefault().concat(api.middleware),
  });
  setupListeners(store.dispatch);
  return store;
}

export const store = makeStore();

export type AppStore = typeof store;
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export type AppThunk<Return = void> = ThunkAction<Return, RootState, unknown, Action<string>>;
