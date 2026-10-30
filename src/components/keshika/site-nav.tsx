"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import { KeshikaLogo, LMS_HREF } from "./brand";
import { cn } from "@/lib/utils";

const LINKS = [
  { label: "Home", href: "#top" },
  { label: "About Me", href: "#about" },
  { label: "My Teaching Approach", href: "#approach" },
];

/** Sticky public navigation for the Physics with Keshika site. */
export function SiteNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-orbit-border/70 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-8">
        <KeshikaLogo />

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-full px-3.5 py-2 text-sm text-orbit-text-secondary transition-colors hover:bg-orbit-panel hover:text-orbit-text"
            >
              {l.label}
            </a>
          ))}
          <Link
            href={LMS_HREF}
            className="btn-primary group ml-3 inline-flex items-center gap-1.5 rounded-full px-4.5 py-2 text-sm font-medium"
          >
            Access LMS
            <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 md:hidden">
          <Link href={LMS_HREF} className="btn-primary whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium">
            Access LMS
          </Link>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            className="rounded-lg p-2 text-orbit-text-secondary transition-colors hover:bg-orbit-panel hover:text-orbit-text"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      <nav id="mobile-nav" aria-label="Primary" className={cn("border-t border-orbit-border bg-white px-5 py-3 md:hidden", !open && "hidden")}>
        <ul className="space-y-0.5">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                onClick={() => setOpen(false)}
                className="block rounded-xl px-3 py-2.5 text-[15px] text-orbit-text-secondary hover:bg-orbit-panel hover:text-orbit-text"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
