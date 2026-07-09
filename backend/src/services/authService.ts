import { and, eq, isNull } from 'drizzle-orm';
import type { Request } from 'express';
import { db } from '../db/client.js';
import type { UserRole } from '../db/enums.js';
import { appUser, refreshToken } from '../db/schema.js';
import { HttpError } from '../middleware/errorHandler.js';
import { verifyPassword } from '../lib/passwords.js';
import {
  parseRefreshCookie,
  signAccessToken,
  signRefreshToken,
  verifyRefreshSecret,
  type SignedAccessToken,
  type SignedRefreshToken,
} from '../lib/tokens.js';

export interface AuthenticatedUser {
  userId: number;
  username: string;
  role: UserRole;
  fullName: string | null;
  canCreateProjects: boolean;
  canUpdateProjects: boolean;
  canDeleteProjects: boolean;
}

export interface LoginResult {
  user: AuthenticatedUser;
  access: SignedAccessToken;
  refresh: SignedRefreshToken;
}

function requestFingerprint(req: Request): { userAgent: string | null; ip: string | null } {
  const ua = req.get('user-agent') ?? null;
  const ip = req.ip ?? null;
  return { userAgent: ua, ip };
}

async function persistRefreshToken(
  userId: number,
  refresh: SignedRefreshToken,
  req: Request,
): Promise<void> {
  const { userAgent, ip } = requestFingerprint(req);
  await db.insert(refreshToken).values({
    tokenId: refresh.tokenId,
    userId,
    tokenHash: refresh.tokenHash,
    expiresAt: refresh.expiresAt,
    userAgent,
    ipAddress: ip,
  });
}

export async function login(
  username: string,
  password: string,
  req: Request,
): Promise<LoginResult> {
  const [row] = await db
    .select()
    .from(appUser)
    .where(eq(appUser.username, username))
    .limit(1);

  if (!row || !row.isActive) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid username or password');
  }

  const ok = await verifyPassword(password, row.passwordHash);
  if (!ok) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid username or password');
  }

  await db.update(appUser).set({ lastLogin: new Date() }).where(eq(appUser.userId, row.userId));

  const user: AuthenticatedUser = {
    userId: row.userId,
    username: row.username,
    role: row.role as UserRole,
    fullName: row.fullName,
    canCreateProjects: row.canCreateProjects,
    canUpdateProjects: row.canUpdateProjects,
    canDeleteProjects: row.canDeleteProjects,
  };

  const access = signAccessToken({
    sub: String(user.userId),
    role: user.role,
    name: user.fullName ?? user.username,
  });
  const refresh = await signRefreshToken(user.userId);
  await persistRefreshToken(user.userId, refresh, req);

  return { user, access, refresh };
}

export interface RefreshResult {
  user: AuthenticatedUser;
  access: SignedAccessToken;
  refresh: SignedRefreshToken;
}

export async function refresh(cookieValue: string, req: Request): Promise<RefreshResult> {
  let parsed;
  try {
    parsed = parseRefreshCookie(cookieValue);
  } catch {
    throw new HttpError(401, 'INVALID_REFRESH', 'Refresh token invalid');
  }

  const [row] = await db
    .select()
    .from(refreshToken)
    .where(eq(refreshToken.tokenId, parsed.payload.jti))
    .limit(1);

  if (!row) {
    throw new HttpError(401, 'INVALID_REFRESH', 'Refresh token invalid');
  }
  if (row.revokedAt) {
    // Reuse of a rotated/revoked token is a red flag — nuke every active
    // session for the user so an attacker holding an old copy can't proceed.
    await db
      .update(refreshToken)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshToken.userId, row.userId), isNull(refreshToken.revokedAt)));
    throw new HttpError(401, 'INVALID_REFRESH', 'Refresh token reuse detected');
  }
  if (row.expiresAt.getTime() <= Date.now()) {
    throw new HttpError(401, 'INVALID_REFRESH', 'Refresh token expired');
  }

  const secretOk = await verifyRefreshSecret(parsed.rawSecret, row.tokenHash);
  if (!secretOk) {
    throw new HttpError(401, 'INVALID_REFRESH', 'Refresh token invalid');
  }

  const [userRow] = await db
    .select()
    .from(appUser)
    .where(eq(appUser.userId, row.userId))
    .limit(1);

  if (!userRow || !userRow.isActive) {
    throw new HttpError(401, 'USER_INACTIVE', 'User account is inactive');
  }

  const nextRefresh = await signRefreshToken(userRow.userId);

  await db.transaction(async (tx) => {
    await tx.insert(refreshToken).values({
      tokenId: nextRefresh.tokenId,
      userId: userRow.userId,
      tokenHash: nextRefresh.tokenHash,
      expiresAt: nextRefresh.expiresAt,
      userAgent: req.get('user-agent') ?? null,
      ipAddress: req.ip ?? null,
    });
    await tx
      .update(refreshToken)
      .set({ revokedAt: new Date(), replacedBy: nextRefresh.tokenId })
      .where(eq(refreshToken.tokenId, row.tokenId));
  });

  const user: AuthenticatedUser = {
    userId: userRow.userId,
    username: userRow.username,
    role: userRow.role as UserRole,
    fullName: userRow.fullName,
    canCreateProjects: userRow.canCreateProjects,
    canUpdateProjects: userRow.canUpdateProjects,
    canDeleteProjects: userRow.canDeleteProjects,
  };

  const access = signAccessToken({
    sub: String(user.userId),
    role: user.role,
    name: user.fullName ?? user.username,
  });

  return { user, access, refresh: nextRefresh };
}

export async function logout(cookieValue: string | undefined): Promise<void> {
  if (!cookieValue) return;
  let parsed;
  try {
    parsed = parseRefreshCookie(cookieValue);
  } catch {
    return;
  }
  await db
    .update(refreshToken)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshToken.tokenId, parsed.payload.jti), isNull(refreshToken.revokedAt)));
}

export async function getUserById(userId: number): Promise<AuthenticatedUser | null> {
  const [row] = await db.select().from(appUser).where(eq(appUser.userId, userId)).limit(1);
  if (!row || !row.isActive) return null;
  return {
    userId: row.userId,
    username: row.username,
    role: row.role as UserRole,
    fullName: row.fullName,
    canCreateProjects: row.canCreateProjects,
    canUpdateProjects: row.canUpdateProjects,
    canDeleteProjects: row.canDeleteProjects,
  };
}
