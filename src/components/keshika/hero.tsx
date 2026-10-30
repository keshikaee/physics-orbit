import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight } from "lucide-react";
import portrait from "@/assets/keshika-portrait.jpeg";
import { LMS_HREF } from "./brand";

export function Hero() {
  return (
    <section id="top" aria-labelledby="hero-heading" className="relative scroll-mt-16 overflow-hidden">
      {/* One soft wash in the corner; nothing that competes with the photograph. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60rem_40rem_at_100%_0%,#e8f5ec_0%,rgba(232,245,236,0)_60%)]"
      />

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-12 sm:px-8 sm:pt-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-16 lg:pb-28 lg:pt-20">
        <div className="animate-rise order-2 lg:order-1">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-orbit-primary">Learn · Understand · Apply</p>
          <h1 id="hero-heading" className="mt-4 text-[2.9rem] font-semibold leading-[1.02] tracking-tight text-orbit-text sm:text-6xl lg:text-7xl">
            Physics with <span className="text-orbit-primary">Keshika</span>
          </h1>
          <p className="mt-5 text-xl font-medium tracking-tight text-orbit-primary-hover sm:text-2xl">
            Understand Physics. Think Beyond Equations.
          </p>
          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-orbit-text-secondary">
            Discover a different way of learning physics — through clear explanations, imagination, practical understanding, and
            meaningful connections to the real world.
          </p>

          <blockquote className="mt-7 max-w-xl border-l-2 border-orbit-primary pl-4 text-[15px] leading-relaxed text-orbit-text">
            I believe the most important question a student can ask is{" "}
            <span className="font-semibold text-orbit-primary-hover">&ldquo;Why?&rdquo;</span>
          </blockquote>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href="#classes"
              className="btn-primary group inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-medium"
            >
              Explore My Classes
              <ArrowDown size={16} className="transition-transform group-hover:translate-y-0.5" aria-hidden="true" />
            </a>
            <Link
              href={LMS_HREF}
              className="btn-secondary group inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-medium"
            >
              Access Physics Orbit LMS
              <ArrowRight size={16} className="text-orbit-primary transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="animate-rise order-1 lg:order-2">
          <figure className="relative mx-auto w-full max-w-[22rem] sm:max-w-md lg:max-w-none">
            {/* Soft mint disc behind the portrait, offset up and right. */}
            <div aria-hidden="true" className="absolute -right-5 -top-5 h-[88%] w-[88%] rounded-full bg-orbit-panel-hover sm:-right-8 sm:-top-8" />
            <div aria-hidden="true" className="absolute -bottom-4 -left-4 h-24 w-24 rounded-full border border-[#cfe5d6] sm:h-32 sm:w-32" />
            <div className="relative overflow-hidden rounded-[2rem] shadow-[0_24px_60px_-28px_rgba(20,83,45,0.45)]">
              <Image
                src={portrait}
                alt="Keshika, physics educator, in a dark suit and tie, thinking as he looks at a laptop"
                priority
                placeholder="blur"
                sizes="(min-width: 1024px) 30rem, (min-width: 640px) 28rem, 22rem"
                className="aspect-square h-auto w-full object-cover"
              />
            </div>
            <figcaption className="absolute -bottom-5 right-4 rounded-2xl border border-orbit-border bg-white/95 px-4 py-2.5 shadow-[var(--shadow-card)] backdrop-blur sm:right-6">
              <span className="block text-[15px] font-semibold text-orbit-text">Keshika</span>
              <span className="block text-xs text-orbit-text-secondary">Physics Educator</span>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
