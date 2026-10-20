"use client";

import { useMemo, useState } from "react";
import { FolderOpen, Layers, Users } from "lucide-react";
import { accessSummary, grantKey } from "@/lib/content/access";
import type { AdminUnit } from "@/lib/content/queries";
import type { AccessMode, ContentKind } from "@/types";
import { Badge } from "@/components/content/badges";
import { AccessEditor, type PickerStudent } from "./access-picker";
import { MATERIAL_ICONS } from "./material-icons";
import { cn } from "@/lib/utils";

type Row = {
  kind: ContentKind;
  id: string;
  title: string;
  depth: 0 | 1 | 2;
  mode: AccessMode;
  published: boolean;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  parentNote?: string;
};

/** Content-wise access at a glance: every item, who can see it, and an inline editor. */
export function AccessOverview({
  units,
  grants,
  students,
  groupName,
}: {
  units: AdminUnit[];
  grants: Record<string, string[]>;
  students: PickerStudent[];
  groupName?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [onlyRestricted, setOnlyRestricted] = useState(false);

  const rows = useMemo(() => {
    const out: Row[] = [];
    for (const u of units) {
      out.push({ kind: "unit", id: u.id, title: `${u.code}: ${u.title}`, depth: 0, mode: u.access_mode, published: u.is_published, icon: Layers });
      for (const t of u.topics) {
        out.push({
          kind: "topic",
          id: t.id,
          title: t.title,
          depth: 1,
          mode: t.access_mode,
          published: t.is_published,
          icon: FolderOpen,
          parentNote: `Students also need access to ${u.code}.`,
        });
        for (const m of t.materials) {
          out.push({
            kind: "material",
            id: m.id,
            title: m.title,
            depth: 2,
            mode: m.access_mode,
            published: m.is_published,
            icon: MATERIAL_ICONS[m.kind].icon,
            parentNote: `Students also need access to “${t.title}” and ${u.code}.`,
          });
        }
      }
    }
    return out;
  }, [units]);

  const shown = onlyRestricted ? rows.filter((r) => r.mode === "selected") : rows;

  if (rows.length === 0) {
    return <p className="rounded-2xl border border-dashed border-orbit-border bg-white p-8 text-center text-sm text-orbit-text-muted">No content yet.</p>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-orbit-border bg-white shadow-[var(--shadow-card)]">
      <label className="flex cursor-pointer items-center gap-2.5 border-b border-orbit-border-subtle px-4 py-3 text-sm text-orbit-text-secondary">
        <input type="checkbox" checked={onlyRestricted} onChange={(e) => setOnlyRestricted(e.target.checked)} className="h-4 w-4 accent-[#166534]" />
        Show only items limited to selected students
      </label>
      {shown.length === 0 && <p className="p-6 text-center text-sm text-orbit-text-muted">Everything is open to all students.</p>}
      <ul className="divide-y divide-orbit-border-subtle">
        {shown.map((r) => {
          const granted = grants[grantKey(r.kind, r.id)] ?? [];
          const open = openId === r.id;
          const Icon = r.icon;
          return (
            <li key={r.id}>
              <div className={cn("flex flex-wrap items-center gap-3 py-3 pr-4", ["pl-4", "pl-9 sm:pl-11", "pl-14 sm:pl-[4.5rem]"][r.depth])}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orbit-panel-hover">
                  <Icon size={15} strokeWidth={1.75} className="text-orbit-primary" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-sm text-orbit-text", r.depth === 0 && "font-semibold")}>{r.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
                    <span className={cn("inline-flex items-center gap-1", r.mode === "selected" ? "font-medium text-orbit-primary-text" : "text-orbit-text-muted")}>
                      <Users size={12} aria-hidden="true" /> {accessSummary(r.mode, granted.length)}
                    </span>
                    {!r.published && <Badge>Draft</Badge>}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : r.id)}
                  aria-expanded={open}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                    open ? "border-orbit-primary bg-orbit-panel-hover text-orbit-primary-hover" : "border-orbit-border text-orbit-text-secondary hover:bg-orbit-panel"
                  )}
                >
                  Manage access
                </button>
              </div>
              {open && (
                <div className="animate-rise border-t border-orbit-border-subtle bg-orbit-canvas p-4 sm:p-5">
                  <AccessEditor
                    kind={r.kind}
                    id={r.id}
                    mode={r.mode}
                    granted={granted}
                    students={students}
                    groupName={groupName}
                    parentNote={r.parentNote}
                    onDone={() => setOpenId(null)}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
