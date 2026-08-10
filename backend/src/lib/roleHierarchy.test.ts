import { describe, expect, it } from 'vitest';
import { APPROVER_ROLES, approverRolesLabel } from './roleHierarchy.js';

describe('APPROVER_ROLES', () => {
  it('MD has no approvers (self-service)', () => {
    expect(APPROVER_ROLES.MD).toEqual([]);
  });
  it('escalates one level per role down the hierarchy', () => {
    expect(APPROVER_ROLES.Admin).toEqual(['MD']);
    expect(APPROVER_ROLES.PD).toEqual(['MD', 'Admin']);
    expect(APPROVER_ROLES.Viewer).toEqual(['MD', 'Admin', 'PD']);
  });
});

describe('approverRolesLabel', () => {
  it('formats zero, one, two, and three+ roles', () => {
    expect(approverRolesLabel('MD')).toBe('');
    expect(approverRolesLabel('Admin')).toBe('MD');
    expect(approverRolesLabel('PD')).toBe('MD or Admin');
    expect(approverRolesLabel('Viewer')).toBe('MD, Admin, or PD');
  });
});
