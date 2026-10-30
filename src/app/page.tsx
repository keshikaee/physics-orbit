import type { Metadata } from "next";
import { SiteNav } from "@/components/keshika/site-nav";
import { Hero } from "@/components/keshika/hero";
import { About } from "@/components/keshika/about";
import { Philosophy } from "@/components/keshika/philosophy";
import { Methods } from "@/components/keshika/methods";
import { LmsSection } from "@/components/keshika/lms-section";
import { BeyondTuition, FinalCta, SiteFooter } from "@/components/keshika/closing";

/*
 * Public website: "Physics with Keshika" (personal brand).
 * Physics Orbit, the LMS, lives behind /login and is introduced here as the
 * supporting platform. This page has no data access and is fully static.
 */

const TITLE = "Physics with Keshika | Learn Physics Through Understanding";
const DESCRIPTION =
  "Learn physics with Keshika through clear explanations, imagination-based teaching, practical demonstrations, and structured digital learning.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", siteName: "Physics with Keshika" },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
};

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <a
        href="#main"
        className="sr-only z-[60] rounded-lg bg-white px-4 py-2 text-sm font-medium text-orbit-primary-hover focus:not-sr-only focus:fixed focus:left-4 focus:top-3"
      >
        Skip to content
      </a>
      <SiteNav />
      <main id="main" className="flex-1">
        <Hero />
        <About />
        <Philosophy />
        <Methods />
        <BeyondTuition />
        <LmsSection />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}
