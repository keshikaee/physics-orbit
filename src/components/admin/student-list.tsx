"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import type { StudentSummary } from "@/lib/content/queries";
import { districtName } from "@/lib/curriculum/profile";
import { cn } from "@/lib/utils";

type Filter = "all" | "none" | string; // curriculum id

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

export function StudentList({
  students,
  curricula,
  initialFilter = "all",
}: {
  students: StudentSummary[];
  curricula: { id: string; name: string; slug: string }[];
  initialFilter?: Filter;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const nameOf = useMemo(() => new Map(curricula.map((c) => [c.id, c.name])), [curricula]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of students) m.set(s.curriculum_id ?? "none", (m.get(s.curriculum_id ?? "none") ?? 0) + 1);
    return m;
  }, [students]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      if (filter === "none" ? s.curriculum_id !== null : filter !== "all" && s.curriculum_id !== filter) return false;
      if (!q) return true;
      return [s.full_name, s.email, s.institute ?? "", districtName(s.district) ?? ""].some((v) => v.toLowerCase().includes(q));
    });
  }, [students, query, filter]);

  const chips: { id: Filter; label: string; n: number }[] = [
    { id: "all", label: "All", n: students.length },
    ...curricula.map((c) => ({ id: c.id, label: c.name, n: counts.get(c.id) ?? 0 })),
    ...(counts.get("none") ? [{ id: "none", label: "No curriculum", n: counts.get("none")! }] : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by curriculum">
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={filter === c.id}
            onClick={() => setFilter(c.id)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              filter === c.id
                ? "border-orbit-primary bg-orbit-primary text-white"
                : c.id === "none"
                  ? "border-[#f5dfb3] bg-orbit-warning-muted text-orbit-warning hover:opacity-90"
                  : "border-orbit-border bg-white text-orbit-text-secondary hover:bg-orbit-panel",
            )}
          >
            {c.label} <span className={filter === c.id ? "text-white/80" : "text-orbit-text-muted"}>({c.n})</span>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-orbit-border bg-white shadow-[var(--shadow-card)]">
        <div className="border-b border-orbit-border-subtle p-3">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-orbit-text-muted" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, email, institute or district"
              aria-label="Search students"
              className="w-full rounded-xl border border-orbit-border bg-orbit-panel py-2.5 pl-10 pr-3 text-[15px] text-orbit-text placeholder:text-orbit-text-muted focus:border-orbit-primary focus:outline-none focus:ring-4 focus:ring-orbit-primary/10"
            />
          </div>
        </div>

        {students.length === 0 ? (
          <p className="p-8 text-center text-sm text-orbit-text-muted">No students have registered yet.</p>
        ) : shown.length === 0 ? (
          <p className="p-8 text-center text-sm text-orbit-text-muted">No students match.</p>
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,2fr)_7rem_minmax(0,1.4fr)_8rem_6.5rem_1rem] gap-3 border-b border-orbit-border-subtle px-4 py-2 text-xs font-medium uppercase tracking-wide text-orbit-text-muted md:grid">
              <span>Student</span>
              <span>Curriculum</span>
              <span>Institute</span>
              <span>District</span>
              <span>Status</span>
              <span />
            </div>
            <ul className="divide-y divide-orbit-border-subtle">
              {shown.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/admin/students/${s.id}`}
                    className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-orbit-panel md:grid-cols-[minmax(0,2fr)_7rem_minmax(0,1.4fr)_8rem_6.5rem_1rem]"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orbit-panel-hover text-sm font-semibold text-orbit-primary-hover"
                      >
                        {initials(s.full_name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-orbit-text">{s.full_name}</span>
                        <span className="block truncate text-sm text-orbit-text-muted">{s.email}</span>
                      </span>
                    </span>
                    <span className="md:order-none">
                      {s.curriculum_id ? (
                        <span className="rounded-full bg-orbit-primary-muted px-2.5 py-0.5 text-xs font-medium text-orbit-primary-hover">
                          {nameOf.get(s.curriculum_id)}
                        </span>
                      ) : (
                        <span className="rounded-full bg-orbit-warning-muted px-2.5 py-0.5 text-xs font-medium text-orbit-warning">Not set</span>
                      )}
                    </span>
                    <span className="col-span-2 truncate pl-[3.25rem] text-sm text-orbit-text-secondary md:col-span-1 md:pl-0">
                      {s.institute ?? "—"}
                      <span className="md:hidden">{s.district ? ` · ${districtName(s.district)}` : ""}</span>
                    </span>
                    <span className="hidden truncate text-sm text-orbit-text-secondary md:block">{districtName(s.district) ?? "—"}</span>
                    <span className="hidden md:block">
                      {s.status !== "active" ? (
                        <span className="rounded-full bg-orbit-warning-muted px-2.5 py-0.5 text-xs font-medium text-orbit-warning">Deactivated</span>
                      ) : (
                        <span className="rounded-full bg-orbit-primary-muted px-2.5 py-0.5 text-xs font-medium text-orbit-primary-hover">Active</span>
                      )}
                    </span>
                    <ChevronRight
                      size={18}
                      className="hidden text-orbit-text-muted transition-transform group-hover:translate-x-0.5 md:block"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="border-t border-orbit-border-subtle px-4 py-2.5 text-xs text-orbit-text-muted">
          {shown.length} of {students.length} {students.length === 1 ? "student" : "students"}
        </p>
      </div>
    </div>
  );
}
