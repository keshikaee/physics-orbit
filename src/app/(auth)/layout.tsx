import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { OrbitLogo } from "@/components/layout/orbit-logo";

export const metadata: Metadata = {
  title: "Sign In",
};

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(ellipse_at_50%_0%,#e8f5ec_0%,#f9fbfa_55%)]">
      <header className="flex items-center justify-between px-5 py-5 sm:px-8">
        <OrbitLogo size="sm" />
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-orbit-text-secondary transition-colors hover:text-orbit-text"
        >
          <ArrowLeft size={15} aria-hidden="true" /> Home
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md animate-rise">{children}</div>
      </main>

      <footer className="px-6 py-5 text-center text-xs text-orbit-text-muted">
        Physics Orbit · Learn · Practice · Grow
      </footer>
    </div>
  );
}
