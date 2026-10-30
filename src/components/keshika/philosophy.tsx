import { SectionHeading } from "./brand";

/** "Learning Physics Through Understanding and Imagination" — editorial, typography-led. */
export function Philosophy() {
  return (
    <section id="approach" aria-labelledby="approach-heading" className="scroll-mt-16 border-t border-orbit-border-subtle px-5 py-24 sm:px-8 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="My teaching approach"
          id="approach-heading"
          title="Learning Physics Through Understanding and Imagination"
          className="reveal max-w-3xl"
        />

        <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-16">
          <div className="reveal space-y-6 text-[17px] leading-relaxed text-orbit-text-secondary">
            <p className="text-2xl font-medium leading-snug tracking-tight text-orbit-text text-balance">
              Physics is more than equations, definitions, and examination questions. It is a way of understanding how the world works.
            </p>
            <p>
              In my classes, I focus on helping students develop a clear mental picture of physical concepts before approaching
              mathematical problems.
            </p>
            <p>I encourage students to ask questions, explore ideas, and understand why physical laws work the way they do.</p>
            <p>
              My teaching combines conceptual explanations, mathematical reasoning, visual learning, and practical demonstrations.
            </p>
            <p className="font-medium text-orbit-text">
              The aim is to build a strong understanding of physics that supports both examination success and real-world
              problem-solving.
            </p>
          </div>

          <figure className="reveal self-start rounded-3xl border border-orbit-border bg-white p-6 sm:p-8">
            <ProjectileDiagram />
            <figcaption className="mt-5 border-t border-orbit-border-subtle pt-4 text-sm leading-relaxed text-orbit-text-secondary">
              <span className="font-medium text-orbit-text">Picture it first.</span> See how a thrown ball moves (its path, its velocity,
              the pull of gravity) before writing a single equation.
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}

/** A projectile: dashed path, velocity components at launch, constant g. Thin lines, brand green. */
function ProjectileDiagram() {
  return (
    <svg
      viewBox="0 0 320 200"
      role="img"
      aria-label="Diagram of a projectile: a curved path from launch to landing, the launch velocity split into horizontal and vertical components, and gravity acting downward."
      className="h-auto w-full"
    >
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill="#166534" />
        </marker>
        <marker id="arrow-muted" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill="#64756b" />
        </marker>
      </defs>

      {/* Ground */}
      <line x1="16" y1="172" x2="304" y2="172" stroke="#e5ebe7" strokeWidth="2" />

      {/* Path y = parabola from (40,172) to (280,172), apex (160,52) */}
      <path d="M40 172 Q160 -68 280 172" fill="none" stroke="#166534" strokeWidth="2" strokeDasharray="5 6" strokeLinecap="round" />

      {/* Launch velocity and its components */}
      <line x1="40" y1="172" x2="88" y2="76" stroke="#166534" strokeWidth="2" markerEnd="url(#arrow)" />
      <line x1="40" y1="172" x2="88" y2="172" stroke="#64756b" strokeWidth="1.5" strokeDasharray="3 4" markerEnd="url(#arrow-muted)" />
      <line x1="40" y1="172" x2="40" y2="76" stroke="#64756b" strokeWidth="1.5" strokeDasharray="3 4" markerEnd="url(#arrow-muted)" />
      <text x="52" y="104" fill="#14532d" fontSize="13" fontStyle="italic" fontWeight="600">
        u
      </text>
      <text x="92" y="166" fill="#5e6f65" fontSize="11" fontStyle="italic">
        u cos θ
      </text>
      <text x="34" y="138" textAnchor="end" fill="#5e6f65" fontSize="11" fontStyle="italic">
        u sin θ
      </text>
      <path d="M58 172 A18 18 0 0 0 48 156" fill="none" stroke="#5e6f65" strokeWidth="1.2" />
      <text x="62" y="162" fill="#5e6f65" fontSize="11" fontStyle="italic">
        θ
      </text>

      {/* Ball at the apex, horizontal velocity only, gravity down */}
      <circle cx="160" cy="52" r="7" fill="#166534" />
      <line x1="170" y1="52" x2="214" y2="52" stroke="#166534" strokeWidth="2" markerEnd="url(#arrow)" />
      <line x1="160" y1="62" x2="160" y2="102" stroke="#64756b" strokeWidth="1.5" markerEnd="url(#arrow-muted)" />
      <text x="166" y="96" fill="#5e6f65" fontSize="11" fontStyle="italic">
        g
      </text>
      <text x="196" y="44" fill="#5e6f65" fontSize="11" fontStyle="italic">
        u cos θ
      </text>
    </svg>
  );
}
