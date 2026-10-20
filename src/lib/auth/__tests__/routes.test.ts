import { describe, expect, it } from "vitest";
import {
  homeForRole,
  isAuthPage,
  isProtectedPath,
  isStudentPath,
  isAdminPath,
  isAdminRole,
  legacyAdminRedirect,
  safeNextPath,
} from "../routes";

describe("route classification", () => {
  it("treats admin pages as protected admin paths", () => {
    expect(isAdminPath("/admin/dashboard")).toBe(true);
    expect(isAdminPath("/admin")).toBe(true);
    expect(isProtectedPath("/admin/students/123")).toBe(true);
  });

  it("maps old teacher URLs to the admin portal", () => {
    expect(legacyAdminRedirect("/teacher")).toBe("/admin");
    expect(legacyAdminRedirect("/teacher/content")).toBe("/admin/content");
    expect(legacyAdminRedirect("/teachers-guide")).toBeNull();
    expect(legacyAdminRedirect("/admin/content")).toBeNull();
  });

  it("does not match lookalike prefixes", () => {
    expect(isAdminPath("/administrator")).toBe(false);
    expect(isStudentPath("/dashboarding")).toBe(false);
    expect(isProtectedPath("/labrador")).toBe(false);
  });

  it("protects student pages", () => {
    for (const p of ["/dashboard", "/courses/unit-1", "/lab", "/profile"]) {
      expect(isProtectedPath(p)).toBe(true);
    }
  });

  it("leaves public pages public", () => {
    for (const p of ["/", "/login", "/register", "/forgot-password", "/reset-password", "/auth/callback"]) {
      expect(isProtectedPath(p)).toBe(false);
    }
  });

  it("identifies auth pages (but not reset-password, which needs a session)", () => {
    expect(isAuthPage("/login")).toBe(true);
    expect(isAuthPage("/register")).toBe(true);
    expect(isAuthPage("/reset-password")).toBe(false);
  });
});

describe("homeForRole", () => {
  it("sends students and admins to separate dashboards", () => {
    expect(homeForRole("student")).toBe("/dashboard");
    expect(homeForRole("admin")).toBe("/admin/dashboard");
    expect(homeForRole("teacher")).toBe("/admin/dashboard"); // legacy role value
    expect(isAdminRole("student")).toBe(false);
  });
});

describe("safeNextPath (open-redirect protection)", () => {
  it("accepts same-site relative paths", () => {
    expect(safeNextPath("/courses?unit=1")).toBe("/courses?unit=1");
  });

  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "evil.com", "", null, undefined])(
    "rejects %s",
    (input) => {
      expect(safeNextPath(input, "/fallback")).toBe("/fallback");
    }
  );
});
