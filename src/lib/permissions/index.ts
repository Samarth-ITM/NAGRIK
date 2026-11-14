import type { UserRole } from "@/types";

/**
 * Access Control & Permission Helpers
 * Authority: PRD Section 4 & TRD Section 14
 */

export const ROLES: Record<string, UserRole> = {
  SUPER_ADMIN: "super_admin",
  AUTHORITY_ADMIN: "authority_admin",
  AUTHORITY_OPERATOR: "authority_operator",
  DEMO_VIEWER: "demo_viewer",
} as const;

export function isSuperAdmin(role?: string | null): boolean {
  return role === ROLES.SUPER_ADMIN;
}

export function isAuthorityUser(role?: string | null): boolean {
  return role === ROLES.AUTHORITY_ADMIN || role === ROLES.AUTHORITY_OPERATOR;
}

export function isDemoViewer(role?: string | null): boolean {
  return role === ROLES.DEMO_VIEWER;
}
