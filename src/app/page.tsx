import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { HeroSection } from "@/components/landing/hero-section";
import { FeaturesGrid } from "@/components/landing/features-grid";
import { OrbitLogo } from "@/components/layout/orbit-logo";
import { UnitArt } from "@/components/illustrations/unit-art";

/* Unit 1 topic outline from PROJECT_SPEC.md — the same proposed structure the
   teacher reviews in the content manager. */
const unit1Topics = [
  "Physical quantities, units and vectors",
  "Motion and kinematics",
  "Forces and Newton's laws",
  "Work, energy and power",
  "Materials and mechanical properties",
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />

      <main className="flex-1">
        <HeroSection />
        <FeaturesGrid />

        {/* The AS Physics learning experience */}
        <section id="course" className="scroll-mt-16 px-5 py-24 sm:px-8">
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-orbit-primary-text">Now available</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-orbit-text sm:text-4xl">
                Unit 1: Mechanics and Materials
              </h2>
              <p className="mt-4 max-w-lg text-lg leading-relaxed text-orbit-text-secondary">
                Start with the foundations of AS Physics. Each topic is taught step by step, and the remaining units
                follow as they&apos;re prepared.
              </p>
              <Link
                href="/register"
                className="group mt-8 inline-flex items-center gap-1.5 font-medium text-orbit-primary-text hover:text-orbit-primary-hover"
              >
                Create your student account
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            </div>

            <div className="overflow-hidden rounded-3xl border border-orbit-border bg-white shadow-[var(--shadow-card)]">
              <UnitArt position={1} className="h-36" />
              <ol className="divide-y divide-orbit-border-subtle">
                {unit1Topics.map((topic, i) => (
                  <li key={topic} className="flex items-center gap-4 px-6 py-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orbit-panel-hover text-sm font-semibold text-orbit-primary-hover">
                      {i + 1}
                    </span>
                    <span className="text-orbit-text">{topic}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* Closing call to action */}
        <section className="px-5 pb-24 sm:px-8">
          <div className="mint-wash mx-auto max-w-6xl rounded-3xl border border-[#dcebe1] px-6 py-16 text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-orbit-text">Ready to begin?</h2>
            <p className="mx-auto mt-3 max-w-md text-orbit-text-secondary">
              Register with the email you use for your tuition class to access your lessons.
            </p>
            <Link href="/register" className="btn-primary mt-8 inline-flex items-center rounded-full px-7 py-3.5 font-medium">
              Start Learning
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-orbit-border px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <OrbitLogo size="sm" />
          <p className="text-center text-xs text-orbit-text-muted">Pearson Edexcel International AS Physics tuition</p>
          <div className="flex items-center gap-5 text-sm text-orbit-text-muted">
            <Link href="/login" className="transition-colors hover:text-orbit-text">
              Sign in
            </Link>
            <Link href="/register" className="transition-colors hover:text-orbit-text">
              Register
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
