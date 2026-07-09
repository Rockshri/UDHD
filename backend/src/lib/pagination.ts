import { z } from 'zod';
import { HttpError } from '../middleware/errorHandler.js';

/**
 * Composite keyset cursor: `<createdAt-iso>|<id>`. Sorting is
 * always `created_at DESC, id ASC` — the id tiebreaker makes the
 * page boundary total (no duplicates across pages when two rows
 * share a timestamp).
 */
export interface Cursor {
  createdAt: string;
  id: string;
}

const CURSOR_DELIM = '|';

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(`${cursor.createdAt}${CURSOR_DELIM}${cursor.id}`, 'utf8').toString('base64url');
}

export function decodeCursor(raw: string): Cursor {
  let decoded: string;
  try {
    decoded = Buffer.from(raw, 'base64url').toString('utf8');
  } catch {
    throw new HttpError(400, 'BAD_CURSOR', 'Cursor is not valid base64url');
  }
  const idx = decoded.indexOf(CURSOR_DELIM);
  if (idx === -1) {
    throw new HttpError(400, 'BAD_CURSOR', 'Cursor is malformed');
  }
  const createdAt = decoded.slice(0, idx);
  const id = decoded.slice(idx + 1);
  if (!createdAt || !id || Number.isNaN(Date.parse(createdAt))) {
    throw new HttpError(400, 'BAD_CURSOR', 'Cursor is malformed');
  }
  return { createdAt, id };
}

export const paginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().min(1).optional(),
});

export type PaginationQuery = z.infer<typeof paginationQuery>;

/**
 * Given a page of size `limit + 1`, return the first `limit` and the
 * cursor for the next page. Callers should over-fetch by one row.
 */
export function paginate<T>(
  rows: T[],
  limit: number,
  cursorOf: (row: T) => Cursor,
): { items: T[]; nextCursor: string | null } {
  if (rows.length > limit) {
    const items = rows.slice(0, limit);
    const last = items[items.length - 1];
    if (last === undefined) {
      return { items, nextCursor: null };
    }
    return { items, nextCursor: encodeCursor(cursorOf(last)) };
  }
  return { items: rows, nextCursor: null };
}
