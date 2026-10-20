"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Bell,
  BookOpen,
  ClipboardList,
  KeyRound,
  FlaskConical,
  LayoutDashboard,
  Menu,
  Settings,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { OrbitLogo } from "./orbit-logo";
import { cn } from "@/lib/utils";

type NavItem = { href: string; icon: LucideIcon; label: string; soon?: boolean };

/* `soon` items have no page yet: they render as disabled rows instead of linking to a 404. */
const NAV: Record<"student" | "admin", NavItem[]> = {
  student: [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/courses", icon: BookOpen, label: "Courses" },
    { href: "/lab", icon: FlaskConical, label: "Virtual Lab", soon: true },
    { href: "/assessments", icon: ClipboardList, label: "Assessments", soon: true },
    { href: "/progress", icon: BarChart3, label: "My Progress", soon: true },
    { href: "/notifications", icon: Bell, label: "Notifications", soon: true },
  ],
  admin: [
    { href: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/admin/content", icon: BookOpen, label: "Units & Content" },
    { href: "/admin/students", icon: Users, label: "Students" },
    { href: "/admin/access", icon: KeyRound, label: "Access Management" },
    { href: "/admin/settings", icon: Settings, label: "Settings" },
  ],
};

function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-1">
      {items.map(({ href, icon: Icon, label, soon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        const row = "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition-colors duration-200";
        if (soon) {
          return (
            <li key={href}>
              <span aria-disabled="true" className={cn(row, "text-orbit-text-muted cursor-default")}>
                <Icon size={19} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />
                <span className="flex-1">{label}</span>
                <span className="rounded-full bg-orbit-panel px-2 py-0.5 text-[11px] font-medium text-orbit-text-muted">
                  Soon
                </span>
              </span>
            </li>
          );
        }
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                row,
                active
                  ? "bg-orbit-panel-hover font-medium text-orbit-primary-hover"
                  : "text-orbit-text-secondary hover:bg-orbit-panel hover:text-orbit-text"
              )}
            >
              <Icon
                size={19}
                strokeWidth={active ? 2 : 1.75}
                className={cn("shrink-0", active ? "text-orbit-primary" : "")}
                aria-hidden="true"
              />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * App navigation for both portals: a fixed sidebar on md+ and a top bar with a
 * slide-in drawer on mobile. `profile` is a server-rendered slot (name, role,
 * sign-out) shown at the bottom of both.
 */
export function AppNav({ variant, profile }: { variant: "student" | "admin"; profile: React.ReactNode }) {
  const items = NAV[variant];
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const home = variant === "student" ? "/dashboard" : "/admin/dashboard";

  // Close the drawer after navigation and on Escape.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-orbit-border bg-white/90 px-4 backdrop-blur">
        <OrbitLogo size="sm" href={home} />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="rounded-lg p-2 text-orbit-text-secondary hover:bg-orbit-panel hover:text-orbit-text transition-colors"
        >
          <Menu size={22} />
        </button>
      </header>

      {/* Mobile drawer */}
      <div
        className={cn("md:hidden fixed inset-0 z-40 transition-opacity duration-200", open ? "opacity-100" : "pointer-events-none opacity-0")}
        inert={!open}
      >
        <div className="absolute inset-0 bg-[#172b22]/20 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
        <nav
          aria-label="Main"
          className={cn(
            "absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl transition-transform duration-300 ease-out",
            open ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex h-14 items-center justify-between px-4">
            <OrbitLogo size="sm" href={home} />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="rounded-lg p-2 text-orbit-text-secondary hover:bg-orbit-panel hover:text-orbit-text transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3">
            <NavList items={items} onNavigate={() => setOpen(false)} />
          </div>
          <div className="border-t border-orbit-border p-3">{profile}</div>
        </nav>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-orbit-border bg-white">
        <div className="px-6 pt-7 pb-6">
          <OrbitLogo size="md" tagline href={home} />
        </div>
        <nav aria-label="Main" className="flex-1 overflow-y-auto px-3">
          <NavList items={items} />
        </nav>
        <div className="border-t border-orbit-border p-3">{profile}</div>
      </aside>
    </>
  );
}
