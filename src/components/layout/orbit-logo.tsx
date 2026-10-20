import Link from "next/link";
import { cn } from "@/lib/utils";

interface OrbitLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  /** Small "Learn · Practice · Grow" line under the name. */
  tagline?: boolean;
  href?: string | null;
}

const sizes = {
  sm: { icon: 28, text: "text-[15px]" },
  md: { icon: 34, text: "text-lg" },
  lg: { icon: 44, text: "text-2xl" },
};

/** Atom mark: nucleus with three electron orbits, drawn as a single-colour line icon. */
export function OrbitMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true" className={className}>
      <g stroke="currentColor" strokeWidth="2.2">
        <ellipse cx="24" cy="24" rx="20" ry="7.5" />
        <ellipse cx="24" cy="24" rx="20" ry="7.5" transform="rotate(60 24 24)" />
        <ellipse cx="24" cy="24" rx="20" ry="7.5" transform="rotate(120 24 24)" />
      </g>
      <circle cx="24" cy="24" r="4.2" fill="currentColor" />
    </svg>
  );
}

export function OrbitLogo({ className, size = "md", showText = true, tagline = false, href = "/" }: OrbitLogoProps) {
  const { icon, text } = sizes[size];

  const content = (
    <span className={cn("flex items-center gap-2.5 select-none", className)}>
      <OrbitMark size={icon} className="shrink-0 text-orbit-primary" />
      {showText && (
        <span className="leading-tight">
          <span className={cn("block font-semibold tracking-tight text-orbit-text", text)}>Physics Orbit</span>
          {tagline && (
            <span className="block text-[11px] text-orbit-text-muted tracking-wide">Learn · Practice · Grow</span>
          )}
        </span>
      )}
    </span>
  );

  if (href) {
    return (
      <Link href={href} aria-label="Physics Orbit home" className="rounded-lg">
        {content}
      </Link>
    );
  }
  return content;
}
