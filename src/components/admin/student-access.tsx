import { FolderOpen, Layers } from "lucide-react";
import { setStudentAccessAction } from "@/lib/content/access-actions";
import { allowedAt, visibility, type GrantIndex, type Visibility } from "@/lib/content/access";
import type { AdminUnit } from "@/lib/content/queries";
import type { ContentKind } from "@/types";
import { MATERIAL_ICONS } from "./material-icons";
import { AccessSwitch } from "./access-switch";
import { cn } from "@/lib/utils";

/*
 * Student-wise access: the same content tree, with one switch per item for
 * this student. Switches call set_student_access, which edits the same
 * content_grants rows as the content-wise editor.
 */

function Status({ v }: { v: Visibility }) {
  if (v.visible) return <span className="text-xs font-medium text-orbit-primary-text">Visible</span>;
  if (!v.allowed) return <span className="text-xs text-orbit-text-muted">No access</span>;
  return (
    <span className="text-xs text-orbit-warning">
      {v.blockedBy === "parent" ? "Hidden by a parent" : "Hidden — draft"}
    </span>
  );
}

function ItemRow({
  studentId,
  kind,
  id,
  title,
  icon: Icon,
  v,
  depth,
  sub,
}: {
  studentId: string;
  kind: ContentKind;
  id: string;
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  v: Visibility;
  depth: 0 | 1 | 2;
  sub?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 py-2.5 pr-3", ["pl-3", "pl-8 sm:pl-10", "pl-14 sm:pl-[4.25rem]"][depth])}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orbit-panel-hover">
        <Icon size={15} strokeWidth={1.75} className="text-orbit-primary" />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm", depth === 0 ? "font-semibold text-orbit-text" : "text-orbit-text")}>{title}</p>
        <p className="flex flex-wrap gap-x-2 text-xs text-orbit-text-muted">
          {sub && <span>{sub}</span>}
          <Status v={v} />
        </p>
      </div>
      <AccessSwitch action={setStudentAccessAction} studentId={studentId} kind={kind} id={id} allowed={v.allowed} title={title} />
    </div>
  );
}

export function StudentAccessTree({ studentId, units, index }: { studentId: string; units: AdminUnit[]; index: GrantIndex }) {
  if (units.length === 0) {
    return <p className="p-6 text-center text-sm text-orbit-text-muted">No content has been created yet.</p>;
  }
  return (
    <ul className="divide-y divide-orbit-border-subtle">
      {units.map((unit) => {
        const uv = visibility(allowedAt(index, "unit", unit, studentId), unit.is_published, null);
        return (
          <li key={unit.id}>
            <ItemRow studentId={studentId} kind="unit" id={unit.id} title={`${unit.code}: ${unit.title}`} icon={Layers} v={uv} depth={0} />
            {unit.topics.length > 0 && (
              <ul className="pb-2">
                {unit.topics.map((topic) => {
                  const tv = visibility(allowedAt(index, "topic", topic, studentId), topic.is_published, uv);
                  return (
                    <li key={topic.id}>
                      <ItemRow studentId={studentId} kind="topic" id={topic.id} title={topic.title} icon={FolderOpen} v={tv} depth={1} sub="Subtopic" />
                      {topic.materials.map((m) => (
                        <ItemRow
                          key={m.id}
                          studentId={studentId}
                          kind="material"
                          id={m.id}
                          title={m.title}
                          icon={MATERIAL_ICONS[m.kind].icon}
                          v={visibility(allowedAt(index, "material", m, studentId), m.is_published, tv)}
                          depth={2}
                          sub={MATERIAL_ICONS[m.kind].label}
                        />
                      ))}
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
