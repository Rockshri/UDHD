import { db } from '../db/client.js';
import { district, division, region, scheme, sector } from '../db/schema.js';

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
