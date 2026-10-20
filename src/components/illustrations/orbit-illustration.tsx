import { cn } from "@/lib/utils";

/**
 * Decorative hero art: a green sphere with two tilted electron orbits.
 * Purely visual (aria-hidden); the outer orbit drifts slowly unless the
 * user prefers reduced motion.
 */
export function OrbitIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 320" fill="none" aria-hidden="true" className={cn("w-full h-auto", className)}>
      <defs>
        <radialGradient id="po-sphere" cx="38%" cy="32%" r="70%">
          <stop offset="0%" stopColor="#7fc796" />
          <stop offset="45%" stopColor="#2f855a" />
          <stop offset="100%" stopColor="#14532d" />
        </radialGradient>
        <radialGradient id="po-electron" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#a7d3b5" />
          <stop offset="100%" stopColor="#166534" />
        </radialGradient>
        <radialGradient id="po-shadow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#14532d" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#14532d" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="200" cy="268" rx="96" ry="12" fill="url(#po-shadow)" />

      {/* back orbit */}
      <g className="animate-orbit">
        <ellipse cx="200" cy="160" rx="170" ry="52" transform="rotate(-22 200 160)" stroke="#166534" strokeOpacity="0.35" strokeWidth="1.5" />
        <circle cx="355" cy="92" r="9" fill="url(#po-electron)" />
      </g>
      <ellipse cx="200" cy="160" rx="128" ry="38" transform="rotate(28 200 160)" stroke="#166534" strokeOpacity="0.22" strokeWidth="1.25" strokeDasharray="3 5" />

      <circle cx="200" cy="160" r="60" fill="url(#po-sphere)" />
      <ellipse cx="182" cy="136" rx="20" ry="12" fill="#ffffff" fillOpacity="0.22" transform="rotate(-30 182 136)" />

      {/* electron on the inner (dashed) orbit, in front of the sphere */}
      <circle cx="300" cy="228" r="6" fill="url(#po-electron)" />
    </svg>
  );
}
