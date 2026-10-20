"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { OrbitLogo } from "./orbit-logo";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Course", href: "#course" },
];

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-orbit-border/70 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <OrbitLogo size="sm" />

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className="text-sm text-orbit-text-secondary transition-colors hover:text-orbit-text">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link href="/login" className="rounded-full px-4 py-2 text-sm text-orbit-text-secondary transition-colors hover:text-orbit-text">
            Sign in
          </Link>
          <Link href="/register" className="btn-primary rounded-full px-4 py-2 text-sm font-medium">
            Get Started
          </Link>
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-orbit-text-secondary hover:bg-orbit-panel hover:text-orbit-text md:hidden"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <div className={cn("border-t border-orbit-border bg-white px-5 py-4 md:hidden", !mobileOpen && "hidden")}>
        <div className="space-y-1">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="block rounded-lg px-2 py-2 text-orbit-text-secondary hover:bg-orbit-panel hover:text-orbit-text"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </a>
          ))}
        </div>
        <div className="mt-3 flex flex-col gap-2 border-t border-orbit-border pt-4">
          <Link href="/login" className="btn-secondary rounded-xl px-4 py-2.5 text-center text-sm font-medium">
            Sign in
          </Link>
          <Link href="/register" className="btn-primary rounded-xl px-4 py-2.5 text-center text-sm font-medium">
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}
