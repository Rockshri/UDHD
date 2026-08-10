/**
 * Single source of truth for the hierarchical password-reset workflow's
 * role relationships. Read by request creation (who the OTP is delivered
 * to) and the identify step (the human-readable approver-roles label) —
 * so the hierarchy can never drift between those call sites.
 */

import type { UserRole } from '../db/enums.js';

/** Roles whose OTP-relay counts as approval for a password-reset request from the given role. MD never requests (self-serves). */
export const APPROVER_ROLES: Record<UserRole, UserRole[]> = {
  MD: [],
  Admin: ['MD'],
  PD: ['MD', 'Admin'],
  Viewer: ['MD', 'Admin', 'PD'],
};

/** Human-readable list of approver roles for a given requester role, e.g. "MD, Admin, or PD". */
export function approverRolesLabel(role: UserRole): string {
  const roles = APPROVER_ROLES[role];
  if (roles.length === 0) return '';
  if (roles.length === 1) return roles[0]!;
  if (roles.length === 2) return `${roles[0]} or ${roles[1]}`;
  return `${roles.slice(0, -1).join(', ')}, or ${roles[roles.length - 1]}`;
}
