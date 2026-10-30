import Link from "next/link";
import { ArrowRight, BookOpenText, ClipboardCheck, KeyRound, MousePointerClick, Route, type LucideIcon } from "lucide-react";
import { OrbitLogo } from "@/components/layout/orbit-logo";
import { LMS_HREF, REGISTER_HREF, SectionHeading } from "./brand";

const FEATURES: { icon: LucideIcon; label: string }[] = [
  { icon: BookOpenText, label: "Structured learning materials" },
  { icon: Route, label: "Unit-wise lesson roadmaps" },
  { icon: ClipboardCheck, label: "Quizzes and assessments" },
  { icon: MousePointerClick, label: "Interactive learning resources" },
  { icon: KeyRound, label: "Personalized learning access" },
];

/** Physics Orbit, introduced as the supporting platform (not the site's identity). */
export function LmsSection() {
  return (
    <section id="lms" aria-labelledby="lms-heading" className="scroll-mt-16 px-5 py-24 sm:px-8 sm:py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <div className="reveal">
          <SectionHeading eyebrow="Physics Orbit LMS" id="lms-heading" title="Continue Learning with Physics Orbit" />
          <div className="mt-6 space-y-4 text-[17px] leading-relaxed text-orbit-text-secondary">
            <p>Physics Orbit is the digital learning platform supporting my physics classes.</p>
            <p>
              Students can access organized learning materials, unit-based lesson roadmaps, practice questions, interactive activities,
              and their individual learning progress.
            </p>
          </div>
          <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
            <Link
              href={LMS_HREF}
              className="btn-primary group inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-medium"
            >
              Access Physics Orbit LMS
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
            <p className="text-sm text-orbit-text-secondary">
              New student?{" "}
              <Link href={REGISTER_HREF} className="font-medium text-orbit-primary-text underline-offset-4 hover:underline">
                Create your account
              </Link>
            </p>
          </div>
        </div>

        <div className="reveal rounded-3xl border border-orbit-border bg-white p-6 shadow-[var(--shadow-card)] sm:p-8">
          <OrbitLogo size="md" tagline href={null} />
          <ul className="mt-6 divide-y divide-orbit-border-subtle">
            {FEATURES.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-4 py-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orbit-panel-hover">
                  <Icon size={17} strokeWidth={1.75} className="text-orbit-primary" aria-hidden="true" />
                </span>
                <span className="text-[15px] font-medium text-orbit-text">{label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
