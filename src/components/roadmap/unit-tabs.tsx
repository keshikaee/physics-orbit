import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/* Header + tabs for one unit's admin pages: Content | Roadmap. */
export function UnitTabs({
  unit,
  active,
  children,
  curriculum,
}: {
  curriculum?: { slug: string; name: string } | null;
  unit: { id: string; code: string; title: string };
  active: "content" | "roadmap";
  children?: React.ReactNode;
}) {
  const tabs = [
    { key: "content", label: "Content", href: `/admin/content/${unit.id}` },
    { key: "roadmap", label: "Roadmap", href: `/admin/content/${unit.id}/roadmap` },
  ] as const;
  return (
    <header className="space-y-4">
      <Link
        href={curriculum ? `/admin/content?curriculum=${curriculum.slug}` : "/admin/content"}
        className="inline-flex items-center gap-1.5 text-sm text-orbit-text-secondary hover:text-orbit-text"
      >
        <ArrowLeft size={15} aria-hidden="true" /> Units &amp; Content{curriculum ? ` · ${curriculum.name}` : ""}
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-orbit-primary-text">{unit.code}</p>
          <h1 className="text-3xl font-semibold tracking-tight text-orbit-text">{unit.title}</h1>
        </div>
        {children}
      </div>
      <nav aria-label="Unit sections" className="flex gap-1 border-b border-orbit-border">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            aria-current={active === t.key ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors",
              active === t.key
                ? "border-orbit-primary text-orbit-primary-hover"
                : "border-transparent text-orbit-text-secondary hover:text-orbit-text",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
