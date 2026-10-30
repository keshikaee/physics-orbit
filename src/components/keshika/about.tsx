import { SectionHeading } from "./brand";

/** "Hello, I'm Keshika." — the personal introduction, split into readable parts. */
export function About() {
  return (
    <section id="about" aria-labelledby="about-heading" className="scroll-mt-16 border-t border-orbit-border-subtle px-5 py-24 sm:px-8 sm:py-32">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-20">
        <div className="reveal lg:sticky lg:top-28 lg:self-start">
          <SectionHeading eyebrow="About me" id="about-heading" title="Hello, I'm Keshika." />
          <p className="mt-8 text-2xl font-medium leading-snug tracking-tight text-orbit-primary-hover text-balance sm:text-[1.7rem]">
            &ldquo;I believe that one engineer, one student, one pen, and one piece of paper can make a difference in the world.&rdquo;
          </p>
        </div>

        <div className="space-y-12 text-[17px] leading-relaxed text-orbit-text-secondary">
          <Part title="Who I am">
            <p>
              I&apos;m a final-year undergraduate pursuing a BSc in Electrical and Information Engineering, with a strong passion for
              science communication and physics education.
            </p>
          </Part>

          <Part title="The question that matters most">
            <p>
              As an educator, I believe the most important question a student can ask is{" "}
              <span className="font-semibold text-orbit-text">&lsquo;Why?&rsquo;</span>
            </p>
            <p>
              My goal is not simply to help students memorize formulas or reproduce answers. I want them to understand the reasoning
              behind physical phenomena and develop the confidence to think independently.
            </p>
          </Part>

          <Part title="Imagination first">
            <figure className="rounded-2xl bg-orbit-panel px-6 py-5">
              <blockquote className="text-xl font-medium tracking-tight text-orbit-text">
                &ldquo;Imagination is more important than knowledge.&rdquo;
              </blockquote>
              <figcaption className="mt-1.5 text-sm text-orbit-text-secondary">Often credited to Albert Einstein</figcaption>
            </figure>
            <p>This idea strongly influences my teaching approach.</p>
            <p>
              I encourage students to visualize physical concepts, imagine how systems behave, and connect theoretical knowledge with the
              world around them.
            </p>
          </Part>

          <p className="reveal border-t border-orbit-border pt-8 text-lg font-medium leading-relaxed text-orbit-text">
            When students begin to truly understand physics rather than memorize it, learning becomes much more interesting and enjoyable.
          </p>
        </div>
      </div>
    </section>
  );
}

function Part({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="reveal">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-orbit-text">{title}</h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}
