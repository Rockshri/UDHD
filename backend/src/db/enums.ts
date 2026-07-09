/**
 * CHECK-constrained value sets from the SQL schema, mirrored here as
 * const arrays. Import these into Zod input schemas so the wire format
 * cannot drift from what Postgres will accept.
 */

export const projectStatuses = [
  'Not Started',
  'In Progress',
  'Completed',
  'On Hold',
  'Delayed',
] as const;
export type ProjectStatus = (typeof projectStatuses)[number];

export const projectStages = [
  'Conceptualization',
  'Pre-Tender',
  'Tender',
  'Construction',
  'O&M',
] as const;
export type ProjectStage = (typeof projectStages)[number];

export const workTypes = [
  'Tender Work',
  'Tender Service',
  'Pre-Monsoon',
  'Construction',
  'Others',
] as const;
export type WorkType = (typeof workTypes)[number];

export const currentPhases = [
  'Conceptualization',
  'Design',
  'Pre-Tender',
  'Tender',
  'Construction',
  'O&M',
  'Completed',
] as const;
export type CurrentPhase = (typeof currentPhases)[number];

export const priorities = ['High', 'Medium', 'Low', 'N/A'] as const;
export type Priority = (typeof priorities)[number];

export const omStatusOverrides = [
  'Not Started',
  'Ongoing',
  'Expiring Soon',
  'Expired',
  'Handed Over to ULB',
] as const;
export type OmStatusOverride = (typeof omStatusOverrides)[number];

export const cosCategories = [
  'SCOPE ADDITION',
  'SCOPE DELETION',
  'DESIGN CHANGE',
  'QUANTITY VARIATION',
  'OTHERS',
] as const;
export type CosCategory = (typeof cosCategories)[number];

export const openClosedStatuses = ['Open', 'Closed'] as const;
export type OpenClosedStatus = (typeof openClosedStatuses)[number];

export const geoPhotoSourceTypes = ['url', 'file'] as const;
export type GeoPhotoSourceType = (typeof geoPhotoSourceTypes)[number];

export const momStatuses = [
  'Action Pending',
  'In Progress',
  'Resolved',
  'Deferred',
] as const;
export type MomStatus = (typeof momStatuses)[number];

export const userRoles = ['MD', 'Admin', 'Viewer'] as const;
export type UserRole = (typeof userRoles)[number];

export const auditActions = ['Created', 'Updated', 'Deleted'] as const;
export type AuditAction = (typeof auditActions)[number];
