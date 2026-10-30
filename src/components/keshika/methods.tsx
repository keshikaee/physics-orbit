import { Atom, FlaskConical, Lightbulb, MonitorSmartphone, Sparkles, type LucideIcon } from "lucide-react";
import { SectionHeading } from "./brand";

const METHODS: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Lightbulb,
    title: "Clear Explanations",
    text: "Complex concepts explained step by step, with an emphasis on understanding the reasoning behind them.",
  },
  {
    icon: Sparkles,
    title: "Imagination-Based Learning",
    text: "Visualizing physical phenomena to develop a deeper and more intuitive understanding of physics.",
  },
  {
    icon: MonitorSmartphone,
    title: "Advanced Learning Management System",
    text: "Organized lessons, learning resources, quizzes, and progress tracking through Physics Orbit.",
  },
  {
    icon: Atom,
    title: "Interactive Simulations",
    text: "Exploring physical concepts through simulations that help connect theory with observable behavior.",
  },
  {
    icon: FlaskConical,
    title: "Live Practical Demonstrations",
    text: "Experiencing physics through practical activities and demonstrations that bring classroom concepts to life.",
  },
];

/** "A More Practical Way to Learn Physics": the target of "Explore My Classes". */
export function Methods() {
  return (
    <section id="classes" aria-labelledby="classes-heading" className="scroll-mt-16 border-t border-orbit-border-subtle px-5 py-24 sm:px-8 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <SectionHeading eyebrow="How I teach physics" id="classes-heading" title="A More Practical Way to Learn Physics" className="reveal max-w-2xl" />

        <ol className="mt-14 grid gap-px overflow-hidden rounded-3xl border border-orbit-border bg-orbit-border sm:grid-cols-2 lg:grid-cols-5">
          {METHODS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="reveal group flex flex-col bg-white p-6 transition-colors duration-300 hover:bg-orbit-panel sm:last:col-span-2 lg:p-7 lg:last:col-span-1">
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-orbit-panel-hover transition-colors duration-300 group-hover:bg-white">
                  <Icon size={20} strokeWidth={1.6} className="text-orbit-primary" aria-hidden="true" />
                </span>
                <span className="text-xs font-medium tabular-nums text-orbit-text-muted" aria-hidden="true">
                  0{i + 1}
                </span>
              </div>
              <h3 className="mt-6 text-[17px] font-semibold leading-snug tracking-tight text-orbit-text">{title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-orbit-text-secondary">{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
