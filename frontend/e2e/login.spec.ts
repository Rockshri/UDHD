/**
 * E2E login flow tests.
 *
 * All /api/auth/* traffic is mocked with page.route(), so this suite has
 * NO backend / DB dependency. It exercises the real UI — routing, form
 * submission, RTK Query wiring, error banners, PD two-step handshake.
 */
import { expect, test } from '@playwright/test';

const REFRESH_URL_RE = /\/api\/auth\/refresh$/;
const LOGIN_URL_RE = /\/api\/auth\/login$/;
const ME_URL_RE = /\/api\/auth\/me$/;

function mockRefresh401(page: import('@playwright/test').Page): Promise<void> {
  // App.tsx mounts → fires refresh — mock a 401 so we land on /login cleanly.
  return page.route(REFRESH_URL_RE, (route) => {
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'NO_REFRESH_COOKIE', message: 'x' } }),
    });
  });
}

function mockMe(page: import('@playwright/test').Page, user: unknown): Promise<void> {
  return page.route(ME_URL_RE, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user }),
    });
  });
}

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await mockRefresh401(page);
  });

  test('renders the credentials form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /BUIDCO Project Monitoring/i })).toBeVisible();
    await expect(page.getByPlaceholder('e.g. shri')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  test('surfaces "Invalid username or password" on 401', async ({ page }) => {
    await page.route(LOGIN_URL_RE, (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' },
        }),
      });
    });

    await page.goto('/login');
    await page.getByPlaceholder('e.g. shri').fill('shri');
    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('alert')).toHaveText(/Invalid username or password/i);
    // Still on login page — no redirect.
    await expect(page).toHaveURL(/\/login$/);
  });

  test('surfaces the rate-limit message on 429', async ({ page }) => {
    await page.route(LOGIN_URL_RE, (route) => {
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'RATE_LIMITED', message: 'Too many requests' },
        }),
      });
    });

    await page.goto('/login');
    await page.getByPlaceholder('e.g. shri').fill('shri');
    await page.getByLabel('Password').fill('anything');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('alert')).toHaveText(/Too many attempts/i);
  });

  test('successful MD login redirects away from /login', async ({ page }) => {
    const mdUser = {
      userId: 1,
      username: 'shri',
      role: 'MD',
      fullName: 'Shri',
      canCreateProjects: true,
      canUpdateProjects: true,
      canDeleteProjects: true,
      canViewProjects: true,
    };
    await page.route(LOGIN_URL_RE, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'set-cookie': 'buidco_refresh=stub; Path=/api/auth; HttpOnly' },
        body: JSON.stringify({
          user: mdUser,
          accessToken: 'stub.access.jwt',
          accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
        }),
      });
    });
    await mockMe(page, mdUser);

    await page.goto('/login');
    await page.getByPlaceholder('e.g. shri').fill('shri');
    await page.getByLabel('Password').fill('correct-pw');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Router navigates to '/' after setCredentials fires.
    await expect(page).not.toHaveURL(/\/login$/);
  });

  test('PD two-step: credentials submit → division picker appears', async ({ page }) => {
    await page.route(LOGIN_URL_RE, (route, request) => {
      const body = request.postDataJSON() as { divisionId?: number };
      if (body.divisionId === undefined) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            needsDivision: true,
            divisions: [
              { divisionId: 10, divisionName: 'Patna Municipal' },
              { divisionId: 20, divisionName: 'Gaya' },
            ],
          }),
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: {
              userId: 7,
              username: 'pd_kumar',
              role: 'PD',
              fullName: 'PD Kumar',
              canCreateProjects: false,
              canUpdateProjects: false,
              canDeleteProjects: false,
              canViewProjects: true,
              divisionId: body.divisionId,
            },
            accessToken: 'stub.access.jwt',
            accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
          }),
        });
      }
    });

    await page.goto('/login');
    await page.getByPlaceholder('e.g. shri').fill('pd_kumar');
    await page.getByLabel('Password').fill('pd-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Step 2 UI renders.
    await expect(page.getByText(/Signed in as pd_kumar/i)).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Division' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Continue/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /← Back/i })).toBeVisible();
  });
});
