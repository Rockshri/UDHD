import { z } from 'zod';
import { db } from '../db/client.js';
import { district, division, region, scheme, sector } from '../db/schema.js';
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

/* ── Create-only for now: no update/delete because both tables are FK'd
 *    from project. Renaming would be a data migration; deletion would
 *    orphan projects. If either becomes a requirement we'll design it
 *    then (soft-delete flag on the lookup + guard reads).                 */

const NAME = (max: number) => z.string().trim().min(1).max(max);
export const createSectorSchema = z.object({ sectorName: NAME(40) });
export const createSchemeSchema = z.object({ schemeName: NAME(60) });
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
