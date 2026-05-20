/**
 * Primary Super Admin identity (case-insensitive match).
 * Protected account in Admin (delete / deactivate). Email-based; no DB column required.
 */
export const SUPER_ADMIN_EMAIL = "Mulingwa@ContolTech-ea.com";

export function isProtectedSuperAdminAccount(email: string): boolean {
  return email.trim().toLowerCase() === SUPER_ADMIN_EMAIL.trim().toLowerCase();
}

export function userIsNonDeletableSuperAdmin(u: {
  email: string;
  is_super_admin?: boolean;
}): boolean {
  return Boolean(u.is_super_admin) || isProtectedSuperAdminAccount(u.email);
}
