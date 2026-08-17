import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import {
  district, division, project, projectScheme, region, scheme, sector,
} from '../db/schema.js';
import { HttpError } from '../middleware/errorHandler.js';

export interface LookupsResponse {
  districts: Array<{ districtId: number; districtName: string }>;
  sectors: Array<{ sectorId: number; sectorName: string }>;
  schemes: Array<{ schemeId: number; schemeName: string }>;
  regions: Array<{ regionId: number; regionName: string }>;
  divisions: Array<{ divisionId: number; divisionName: string; regionId: number }>;
}

export async function getLookups(): Promise<LookupsResponse> {
  const [districts, sectors, schemes, regions, divisions] = await Promise.all([
    db.select().from(district).orderBy(district.districtName),
    db.select().from(sector).orderBy(sector.sectorName),
    db.select().from(scheme).orderBy(scheme.schemeName),
    db.select().from(region).orderBy(region.regionName),
    db.select().from(division).orderBy(division.divisionName),
  ]);
  return { districts, sectors, schemes, regions, divisions };
}

/* ── CRUD for the two user-editable lookups ────────────────────────────
 *   Both tables are FK'd from project (sector: project.sector_id;
 *   scheme: project_scheme.scheme_id). Rename is safe because FKs
 *   reference the ID. Delete refuses (409) with a usage count when the
 *   lookup is still in use — the caller can reassign projects first.
 */

const NAME = (max: number) => z.string().trim().min(1).max(max);
export const createSectorSchema = z.object({ sectorName: NAME(40) });
export const createSchemeSchema = z.object({ schemeName: NAME(60) });
export const updateSectorSchema = createSectorSchema;
export const updateSchemeSchema = createSchemeSchema;
export type CreateSectorInput = z.infer<typeof createSectorSchema>;
export type CreateSchemeInput = z.infer<typeof createSchemeSchema>;

export async function createSector(input: CreateSectorInput): Promise<{ sectorId: number; sectorName: string }> {
  try {
    const [row] = await db.insert(sector).values({ sectorName: input.sectorName }).returning();
    if (!row) throw new Error('sector insert did not return a row');
    return row;
  } catch (err) {
    throw wrapUniqueViolation(err, 'sector', input.sectorName);
  }
}

export async function createScheme(input: CreateSchemeInput): Promise<{ schemeId: number; schemeName: string }> {
  try {
    const [row] = await db.insert(scheme).values({ schemeName: input.schemeName }).returning();
    if (!row) throw new Error('scheme insert did not return a row');
    return row;
  } catch (err) {
    throw wrapUniqueViolation(err, 'scheme', input.schemeName);
  }
}

export async function updateSector(
  sectorId: number, input: CreateSectorInput,
): Promise<{ sectorId: number; sectorName: string }> {
  try {
    const [row] = await db
      .update(sector)
      .set({ sectorName: input.sectorName })
      .where(eq(sector.sectorId, sectorId))
      .returning();
    if (!row) throw new HttpError(404, 'SECTOR_NOT_FOUND', `Sector ${sectorId} not found`);
    return row;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw wrapUniqueViolation(err, 'sector', input.sectorName);
  }
}

export async function updateScheme(
  schemeId: number, input: CreateSchemeInput,
): Promise<{ schemeId: number; schemeName: string }> {
  try {
    const [row] = await db
      .update(scheme)
      .set({ schemeName: input.schemeName })
      .where(eq(scheme.schemeId, schemeId))
      .returning();
    if (!row) throw new HttpError(404, 'SCHEME_NOT_FOUND', `Scheme ${schemeId} not found`);
    return row;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw wrapUniqueViolation(err, 'scheme', input.schemeName);
  }
}

export async function deleteSector(sectorId: number): Promise<void> {
  const [count] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(project)
    .where(eq(project.sectorId, sectorId));
  const inUse = Number(count?.n ?? 0);
  if (inUse > 0) {
    throw new HttpError(
      409,
      'SECTOR_IN_USE',
      `Cannot delete: ${inUse} project${inUse === 1 ? '' : 's'} still tagged with this sector. Reassign them first.`,
    );
  }
  const result = await db.delete(sector).where(eq(sector.sectorId, sectorId));
  const affected = (result as unknown as { rowCount?: number }).rowCount ?? 0;
  if (affected === 0) {
    throw new HttpError(404, 'SECTOR_NOT_FOUND', `Sector ${sectorId} not found`);
  }
}

export async function deleteScheme(schemeId: number): Promise<void> {
  const [count] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(projectScheme)
    .where(eq(projectScheme.schemeId, schemeId));
  const inUse = Number(count?.n ?? 0);
  if (inUse > 0) {
    throw new HttpError(
      409,
      'SCHEME_IN_USE',
      `Cannot delete: ${inUse} project${inUse === 1 ? '' : 's'} still tagged with this scheme. Reassign them first.`,
    );
  }
  const result = await db.delete(scheme).where(eq(scheme.schemeId, schemeId));
  const affected = (result as unknown as { rowCount?: number }).rowCount ?? 0;
  if (affected === 0) {
    throw new HttpError(404, 'SCHEME_NOT_FOUND', `Scheme ${schemeId} not found`);
  }
}

/** Convert Postgres unique-violation (23505) into a 409 so the UI can
 *  surface a friendly "already exists" message instead of a 500. */
function wrapUniqueViolation(err: unknown, kind: 'sector' | 'scheme', name: string): unknown {
  const code = (err as { code?: string })?.code;
  if (code === '23505') {
    return new HttpError(
      409,
      'DUPLICATE_NAME',
      `A ${kind} named "${name}" already exists.`,
    );
  }
  return err;
}

// Silence unused-imports for helpers I brought in for scoping future
// work but don't need in this file's current API surface.
void and;
