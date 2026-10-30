import Link from "next/link";
import { cn } from "@/lib/utils";

/* Personal brand: "Physics with Keshika". Physics Orbit (the LMS) keeps its own atom logo. */

/** A single wave in a circle — quiet, physics-flavoured, distinct from the Orbit atom. */
export function KeshikaMark({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className}>
      <circle cx="16" cy="16" r="15" fill="currentColor" />
      <path
        d="M6.5 16c1.6-4.2 3.2-6.3 4.75-6.3S14.4 11.8 16 16s3.2 6.3 4.75 6.3S23.9 20.2 25.5 16"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function KeshikaLogo({ className }: { className?: string }) {
  return (
    <Link href="/" aria-label="Physics with Keshika — home" className={cn("flex items-center gap-2.5 rounded-lg select-none", className)}>
      <KeshikaMark size={28} className="shrink-0 text-orbit-primary-hover" />
      <span className="whitespace-nowrap text-[15px] font-semibold tracking-tight text-orbit-text sm:text-[17px]">
        Physics with <span className="text-orbit-primary">Keshika</span>
      </span>
    </Link>
  );
}

/** Eyebrow + heading used by every landing section. */
export function SectionHeading({
  eyebrow,
  title,
  id,
  className,
  center = false,
}: {
  eyebrow: string;
  title: React.ReactNode;
  id?: string;
  className?: string;
  center?: boolean;
}) {
  return (
    <div className={cn(center && "text-center", className)}>
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-orbit-primary">{eyebrow}</p>
      <h2 id={id} className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-orbit-text text-balance sm:text-[2.6rem]">
        {title}
      </h2>
    </div>
  );
}

export const LMS_HREF = "/login";
export const REGISTER_HREF = "/register";
