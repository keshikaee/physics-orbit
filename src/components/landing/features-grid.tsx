import { BarChart3, BookOpen, ClipboardList, FlaskConical, type LucideIcon } from "lucide-react";

type Feature = { icon: LucideIcon; title: string; description: string; soon?: boolean };

/* `soon` marks features that are planned but not built yet. */
const features: Feature[] = [
  {
    icon: BookOpen,
    title: "Structured lessons",
    description: "Units broken into clear topics and lessons, organised and kept up to date by your teacher.",
  },
  {
    icon: FlaskConical,
    title: "Virtual lab",
    description: "Run experiments in the browser, collect data and plot graphs.",
    soon: true,
  },
  {
    icon: ClipboardList,
    title: "Practice & assessments",
    description: "Topic quizzes and mock papers with instant feedback on objective questions.",
    soon: true,
  },
  {
    icon: BarChart3,
    title: "Progress tracking",
    description: "See what you've finished and which topics need another look.",
    soon: true,
  },
];

export function FeaturesGrid() {
  return (
    <section id="features" className="scroll-mt-16 border-t border-orbit-border bg-orbit-panel/60 px-5 py-24 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-orbit-text sm:text-4xl">Everything in one place</h2>
          <p className="mt-4 text-lg text-orbit-text-secondary">
            Designed around how students actually learn — simple to navigate, nothing to distract.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, description, soon }) => (
            <div key={title} className="card-lift rounded-2xl border border-orbit-border bg-white p-6">
              <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-orbit-panel-hover">
                <Icon size={21} strokeWidth={1.75} className="text-orbit-primary" aria-hidden="true" />
              </span>
              <h3 className="font-semibold text-orbit-text">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-orbit-text-secondary">{description}</p>
              {soon && (
                <p className="mt-4 inline-flex rounded-full bg-orbit-panel px-2.5 py-0.5 text-xs font-medium text-orbit-text-muted">
                  In development
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
