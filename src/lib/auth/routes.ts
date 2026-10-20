import type { UserRole } from "@/types";

/* Pure routing rules — shared by the proxy and server code, and unit-tested. */

export const STUDENT_PREFIXES = [
  "/dashboard",
  "/courses",
  "/lab",
  "/assessments",
  "/quizzes",
  "/progress",
  "/notifications",
  "/profile",
  "/complete-profile",
];
export const ADMIN_PREFIX = "/admin";
/** Old teacher portal URLs; the proxy redirects them to /admin. */
export const LEGACY_TEACHER_PREFIX = "/teacher";
export const AUTH_PAGES = ["/login", "/register", "/forgot-password"];

function matches(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

export function isAdminPath(pathname: string) {
  return matches(pathname, ADMIN_PREFIX);
}

/** "/teacher/content" → "/admin/content"; null when not a legacy URL. */
export function legacyAdminRedirect(pathname: string) {
  if (!matches(pathname, LEGACY_TEACHER_PREFIX)) return null;
  return ADMIN_PREFIX + pathname.slice(LEGACY_TEACHER_PREFIX.length);
}

export function isStudentPath(pathname: string) {
  return STUDENT_PREFIXES.some((p) => matches(pathname, p));
}

export function isProtectedPath(pathname: string) {
  return isAdminPath(pathname) || isStudentPath(pathname);
}

export function isAuthPage(pathname: string) {
  return AUTH_PAGES.some((p) => matches(pathname, p));
}

/** Students → their dashboard; admins (and legacy 'teacher' rows) → the admin portal. */
export function isAdminRole(role: UserRole) {
  return role === "admin" || role === "teacher";
}

export function homeForRole(role: UserRole) {
  return isAdminRole(role) ? "/admin/dashboard" : "/dashboard";
}

/** Only allow same-site relative redirects (blocks `//evil.com`, `https://…`). */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
