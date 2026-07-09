import type { UserRole } from '../db/enums.js';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: number;
        role: UserRole;
        username: string;
        fullName: string | null;
        canCreateProjects: boolean;
        canUpdateProjects: boolean;
        canDeleteProjects: boolean;
      };
    }
  }
}

export {};
