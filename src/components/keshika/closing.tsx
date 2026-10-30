import Link from "next/link";
import { ArrowDown, ArrowRight } from "lucide-react";
import { KeshikaMark, LMS_HREF } from "./brand";

/** "More Than Just a Tuition Class" on a pale green band. */
export function BeyondTuition() {
  return (
    <section aria-labelledby="beyond-heading" className="bg-orbit-panel px-5 py-24 sm:px-8 sm:py-28">
      <div className="reveal mx-auto max-w-4xl">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-orbit-primary">Beyond traditional tuition</p>
        <h2 id="beyond-heading" className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-orbit-text sm:text-[2.6rem]">
          More Than Just a Tuition Class
        </h2>
        <p className="mt-8 text-2xl font-medium leading-snug tracking-tight text-orbit-primary-hover text-balance">
          My aim is to teach physics in a way that stays with students beyond the examination hall.
        </p>
        <div className="mt-8 grid gap-6 text-[17px] leading-relaxed text-orbit-text-secondary sm:grid-cols-2 sm:gap-10">
          <p>
            I want students to recognize physics in everyday life, understand how scientific principles shape the world, and approach
            unfamiliar problems with curiosity and confidence.
          </p>
          <div className="space-y-4">
            <p>A strong conceptual foundation also makes examination preparation more effective.</p>
            <p>
              Through structured lessons, practical exploration, and consistent practice, I help students work towards their highest
              possible examination performance while developing knowledge they can use throughout their lives.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section aria-labelledby="cta-heading" className="px-5 pb-24 sm:px-8 sm:pb-32">
      <div className="reveal mx-auto max-w-6xl rounded-[2rem] bg-orbit-primary-hover px-6 py-16 text-center sm:px-12 sm:py-20">
        <h2 id="cta-heading" className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">
          Let&apos;s Explore Physics Together.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-[#d7ecdf]">
          Whether you&apos;re preparing for examinations or simply curious about how the world works, meaningful learning begins with
          understanding.
        </p>
        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <a
            href="#classes"
            className="group inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-[15px] font-medium text-orbit-primary-hover transition-colors hover:bg-orbit-panel-hover"
          >
            Explore My Classes
            <ArrowDown size={16} className="transition-transform group-hover:translate-y-0.5" aria-hidden="true" />
          </a>
          <Link
            href={LMS_HREF}
            className="group inline-flex items-center justify-center gap-2 rounded-full border border-white/35 px-6 py-3.5 text-[15px] font-medium text-white transition-colors hover:bg-white/10"
          >
            Student LMS Login
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-orbit-border px-5 py-10 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <KeshikaMark size={28} className="text-orbit-primary-hover" />
          <div>
            <p className="font-semibold tracking-tight text-orbit-text">Physics with Keshika</p>
            <p className="text-sm text-orbit-text-secondary">Learn. Understand. Apply.</p>
          </div>
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-orbit-text-secondary">
            <li>
              <a href="#top" className="transition-colors hover:text-orbit-text">
                Home
              </a>
            </li>
            <li>
              <a href="#about" className="transition-colors hover:text-orbit-text">
                About
              </a>
            </li>
            <li>
              <Link href={LMS_HREF} className="transition-colors hover:text-orbit-text">
                Physics Orbit LMS
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <p className="mx-auto mt-8 max-w-6xl border-t border-orbit-border-subtle pt-6 text-xs text-orbit-text-muted">
        © 2026 Physics with Keshika. All rights reserved.
      </p>
    </footer>
  );
}
