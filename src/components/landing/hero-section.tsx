import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { OrbitIllustration } from "@/components/illustrations/orbit-illustration";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[36rem] bg-[radial-gradient(ellipse_at_70%_10%,#e8f5ec_0%,transparent_60%)]"
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pt-16 pb-20 sm:px-8 md:grid-cols-[1.1fr_1fr] md:pt-24 md:pb-28">
        <div className="animate-rise">
          <p className="inline-flex items-center rounded-full border border-orbit-border bg-white px-3.5 py-1 text-xs font-medium text-orbit-text-secondary">
            Pearson Edexcel International AS Physics
          </p>
          <h1 className="mt-6 text-[2.75rem] font-semibold leading-[1.05] tracking-tight text-orbit-text sm:text-6xl">
            Master physics,
            <br />
            <span className="text-orbit-primary">one idea at a time.</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-orbit-text-secondary">
            Clear lessons, guided practice and hands-on experiments for your AS Physics tuition class — all in one calm,
            focused place.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/register"
              className="btn-primary group inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 font-medium"
            >
              Start Learning
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
            <a href="#course" className="btn-secondary inline-flex items-center justify-center rounded-full px-7 py-3.5 font-medium">
              Explore Courses
            </a>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md md:max-w-none">
          <div className="dot-grid absolute inset-6 rounded-[2.5rem] opacity-60" aria-hidden="true" />
          <OrbitIllustration className="relative" />
        </div>
      </div>
    </section>
  );
}
