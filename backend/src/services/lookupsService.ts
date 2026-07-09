import { db } from '../db/client.js';
import { district, scheme, sector } from '../db/schema.js';

export interface LookupsResponse {
  districts: Array<{ districtId: number; districtName: string }>;
  sectors: Array<{ sectorId: number; sectorName: string }>;
  schemes: Array<{ schemeId: number; schemeName: string }>;
}

export async function getLookups(): Promise<LookupsResponse> {
  const [districts, sectors, schemes] = await Promise.all([
    db.select().from(district).orderBy(district.districtName),
    db.select().from(sector).orderBy(sector.sectorName),
    db.select().from(scheme).orderBy(scheme.schemeName),
  ]);
  return { districts, sectors, schemes };
}
