"use client";

import Link from "next/link";
import { createContext, useActionState, useCallback, useContext, useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  FolderOpen,
  Layers,
  Pencil,
  Plus,
  Route,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  createTopicAction,
  createUnitAction,
  deleteAction,
  moveAction,
  setPublishedAction,
  updateTopicAction,
  updateUnitAction,
} from "@/lib/content/actions";
import { accessSummary, grantKey } from "@/lib/content/access";
import type { AdminTopic, AdminUnit } from "@/lib/content/queries";
import { Field, FormMessage, SubmitButton } from "@/components/auth/form-parts";
import { Badge } from "@/components/content/badges";
import type { FormState } from "@/lib/auth/schemas";
import type { AccessMode, ContentKind, Material } from "@/types";
import { AccessEditor, AccessPicker, type PickerStudent } from "./access-picker";
import { Checkbox, TextArea } from "./fields";
import { MATERIAL_KINDS, MaterialForm } from "./material-form";
import { cn } from "@/lib/utils";

type Grants = Record<string, string[]>;
type Panel = null | "edit" | "access" | "delete" | "add";

interface Ctx {
  grants: Grants;
  students: PickerStudent[];
  /** item id → titles of roadmap steps that link it (for delete warnings). */
  refs: Record<string, string[]>;
  roadmaps: Record<string, { published: boolean; steps: number }>;
  /** Curriculum name for access labels ("All Edexcel students"). */
  group?: string;
}

function refWarning(refs: string[] | undefined) {
  if (!refs?.length) return "";
  const names = refs.slice(0, 3).map((r) => `“${r}”`).join(", ") + (refs.length > 3 ? ` and ${refs.length - 3} more` : "");
  return ` Roadmap ${refs.length === 1 ? "step" : "steps"} ${names} link${refs.length === 1 ? "s" : ""} to it — the ${refs.length === 1 ? "step stays but loses" : "steps stay but lose"} this link.`;
}

export const iconButton =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-orbit-border bg-white text-orbit-text-secondary transition-colors hover:border-orbit-primary/40 hover:bg-orbit-panel hover:text-orbit-text disabled:pointer-events-none disabled:opacity-30";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/* ─── Confirmation toast ─── */

const FlashContext = createContext<(message: string) => void>(() => {});

function Toast({ message, onClose }: { message: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [message, onClose]);
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
      {message && (
        <p className="animate-rise inline-flex items-center gap-2 rounded-xl bg-orbit-text px-4 py-2.5 text-sm text-white shadow-[var(--shadow-lift)]">
          <CheckCircle2 size={16} className="text-[#a7d3b5]" aria-hidden="true" /> {message}
        </p>
      )}
    </div>
  );
}

/* ─── Root ─── */

export function ContentTree({
  units,
  grants,
  students,
  refs = {},
  roadmaps = {},
  single = false,
  curriculum,
}: {
  /** The curriculum these units belong to (new units are created in it). */
  curriculum?: { id: string; name: string };
  units: AdminUnit[];
  grants: Grants;
  students: PickerStudent[];
  refs?: Record<string, string[]>;
  roadmaps?: Record<string, { published: boolean; steps: number }>;
  /** One unit's own page: no "Add Unit", unit opened. */
  single?: boolean;
}) {
  const [adding, setAdding] = useState(!single && units.length === 0);
  const [flash, setFlash] = useState<string | null>(null);
  const clearFlash = useCallback(() => setFlash(null), []);
  const ctx = { grants, students, refs, roadmaps, group: curriculum?.name };

  return (
    <FlashContext.Provider value={setFlash}>
      <Toast message={flash} onClose={clearFlash} />
      <div className="space-y-4">
        {!single && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-orbit-text-secondary">
              {plural(units.length, "unit")} · drafts and restricted items are hidden from students who can&apos;t see them.
            </p>
            <button
              type="button"
              onClick={() => setAdding((a) => !a)}
              aria-expanded={adding}
              className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium"
            >
              <Plus size={16} aria-hidden="true" /> Add Unit
            </button>
          </div>
        )}

        {adding && (
          <Card>
            <h2 className="mb-4 font-semibold text-orbit-text">New unit</h2>
            <UnitCreateForm students={students} curriculum={curriculum} onCancel={() => setAdding(false)} />
          </Card>
        )}

        {units.length === 0 && !adding ? (
          <p className="rounded-2xl border border-dashed border-orbit-border bg-white p-8 text-center text-sm text-orbit-text-muted">
            No units yet. Add your first unit to get started.
          </p>
        ) : (
          <ul className="space-y-3">
            {units.map((unit, i) => (
              <UnitNode
                key={unit.id}
                unit={unit}
                ctx={ctx}
                isFirst={i === 0}
                isLast={i === units.length - 1}
                defaultOpen={single || i === 0}
              />
            ))}
          </ul>
        )}
      </div>
    </FlashContext.Provider>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-orbit-border bg-white p-5 shadow-[var(--shadow-card)]", className)}>
      {children}
    </div>
  );
}

/* ─── Unit ─── */

function UnitNode({
  unit,
  ctx,
  isFirst,
  isLast,
  defaultOpen,
}: {
  unit: AdminUnit;
  ctx: Ctx;
  isFirst: boolean;
  isLast: boolean;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [panel, setPanel] = useState<Panel>(null);
  const granted = ctx.grants[grantKey("unit", unit.id)] ?? [];
  const materialCount = unit.topics.reduce((n, t) => n + t.materials.length, 0);
  const roadmap = ctx.roadmaps[unit.id];

  return (
    <li className="overflow-hidden rounded-2xl border border-orbit-border bg-white shadow-[var(--shadow-card)]">
      <Row
        icon={Layers}
        open={open}
        onToggle={() => setOpen((o) => !o)}
        eyebrow={unit.code}
        title={unit.title}
        badges={<StatusBadges published={unit.is_published} placeholder={unit.is_placeholder} review={unit.needs_review} />}
        meta={[
          plural(unit.topics.length, "subtopic"),
          plural(materialCount, "material"),
          ...(roadmap ? [`Roadmap: ${plural(roadmap.steps, "step")}${roadmap.published ? "" : " (draft)"}`] : []),
        ]}
        access={{ mode: unit.access_mode, count: granted.length }}
        links={
          <Link
            href={`/admin/content/${unit.id}/roadmap`}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-orbit-border bg-white px-2.5 text-xs font-medium text-orbit-primary-text transition-colors hover:bg-orbit-panel"
          >
            <Route size={14} aria-hidden="true" /> Roadmap
          </Link>
        }
        kind="unit"
        id={unit.id}
        published={unit.is_published}
        isFirst={isFirst}
        isLast={isLast}
        panel={panel}
        setPanel={setPanel}
        addLabel="Add subtopic"
      />

      {panel && (
        <PanelBox>
          {panel === "edit" && <UnitEditForm unit={unit} onDone={() => setPanel(null)} />}
          {panel === "access" && (
            <AccessEditor
              kind="unit"
              id={unit.id}
              mode={unit.access_mode}
              granted={granted}
              students={ctx.students}
              groupName={ctx.group}
              onDone={() => setPanel(null)}
            />
          )}
          {panel === "delete" && (
            <DeleteConfirm
              kind="unit"
              id={unit.id}
              what={`“${unit.title}”`}
              contents={
                unit.topics.length
                  ? `It contains ${plural(unit.topics.length, "subtopic")} and ${plural(materialCount, "material")}, which will be deleted too, along with any uploaded files.${roadmap ? " Its roadmap, quizzes and all student progress on it will be deleted too." : ""}`
                  : roadmap
                    ? "Its roadmap, quizzes and all student progress on it will be deleted too."
                    : undefined
              }
              onCancel={() => setPanel(null)}
            />
          )}
          {panel === "add" && (
            <>
              <h3 className="mb-4 font-semibold text-orbit-text">New subtopic in {unit.code}</h3>
              <TopicCreateForm unitId={unit.id} students={ctx.students} group={ctx.group} onCancel={() => setPanel(null)} />
            </>
          )}
        </PanelBox>
      )}

      {open && (
        <div className="border-t border-orbit-border-subtle bg-orbit-panel/50 p-3 sm:p-4">
          {unit.topics.length === 0 ? (
            <EmptyChild label="No subtopics yet." action="Add subtopic" onAdd={() => setPanel("add")} />
          ) : (
            <ul className="space-y-2.5">
              {unit.topics.map((topic, i) => (
                <TopicNode
                  key={topic.id}
                  topic={topic}
                  unitAccess={accessSummary(unit.access_mode, granted.length)}
                  ctx={ctx}
                  isFirst={i === 0}
                  isLast={i === unit.topics.length - 1}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

/* ─── Subtopic ─── */

function TopicNode({
  topic,
  unitAccess,
  ctx,
  isFirst,
  isLast,
}: {
  topic: AdminTopic;
  unitAccess: string;
  ctx: Ctx;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const granted = ctx.grants[grantKey("topic", topic.id)] ?? [];

  return (
    <li className="overflow-hidden rounded-xl border border-orbit-border bg-white">
      <Row
        icon={FolderOpen}
        open={open}
        onToggle={() => setOpen((o) => !o)}
        title={topic.title}
        badges={<StatusBadges published={topic.is_published} review={topic.needs_review} />}
        meta={[plural(topic.materials.length, "material")]}
        access={{ mode: topic.access_mode, count: granted.length }}
        kind="topic"
        id={topic.id}
        published={topic.is_published}
        isFirst={isFirst}
        isLast={isLast}
        panel={panel}
        setPanel={setPanel}
        addLabel="Add material"
        compact
      />

      {panel && (
        <PanelBox>
          {panel === "edit" && <TopicEditForm topic={topic} onDone={() => setPanel(null)} />}
          {panel === "access" && (
            <AccessEditor
              kind="topic"
              id={topic.id}
              mode={topic.access_mode}
              granted={granted}
              students={ctx.students}
              groupName={ctx.group}
              parentNote={`Students also need access to the unit (currently: ${unitAccess}).`}
              onDone={() => setPanel(null)}
            />
          )}
          {panel === "delete" && (
            <DeleteConfirm
              kind="topic"
              id={topic.id}
              what={`“${topic.title}”`}
              contents={
                (topic.materials.length
                  ? `Its ${plural(topic.materials.length, "material")} and any uploaded files will be deleted too.`
                  : "") + refWarning(ctx.refs[topic.id]) || undefined
              }
              onCancel={() => setPanel(null)}
            />
          )}
          {panel === "add" && (
            <>
              <h3 className="mb-4 font-semibold text-orbit-text">New material in “{topic.title}”</h3>
              <MaterialForm topicId={topic.id} students={ctx.students} groupName={ctx.group} onDone={() => setPanel(null)} />
            </>
          )}
        </PanelBox>
      )}

      {open && (
        <div className="border-t border-orbit-border-subtle p-2.5 sm:p-3">
          {topic.materials.length === 0 ? (
            <EmptyChild label="No materials yet." action="Add material" onAdd={() => setPanel("add")} />
          ) : (
            <ul className="space-y-1.5">
              {topic.materials.map((m, i) => (
                <MaterialNode
                  key={m.id}
                  material={m}
                  topicTitle={topic.title}
                  ctx={ctx}
                  isFirst={i === 0}
                  isLast={i === topic.materials.length - 1}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

/* ─── Material ─── */

function MaterialNode({
  material,
  topicTitle,
  ctx,
  isFirst,
  isLast,
}: {
  material: Material;
  topicTitle: string;
  ctx: Ctx;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const granted = ctx.grants[grantKey("material", material.id)] ?? [];
  const kind = MATERIAL_KINDS.find((k) => k.kind === material.kind)!;
  const meta = [kind.label, material.notes && material.kind !== "note" ? "with notes" : null].filter(Boolean) as string[];

  return (
    <li className="overflow-hidden rounded-xl border border-orbit-border-subtle bg-orbit-canvas">
      <Row
        icon={kind.icon}
        title={material.title}
        badges={<StatusBadges published={material.is_published} />}
        meta={meta}
        access={{ mode: material.access_mode, count: granted.length }}
        kind="material"
        id={material.id}
        published={material.is_published}
        isFirst={isFirst}
        isLast={isLast}
        panel={panel}
        setPanel={setPanel}
        compact
        preview={material.storage_path ? `/api/materials/${material.id}/file` : (material.url ?? undefined)}
      />
      {panel && (
        <PanelBox>
          {panel === "edit" && <MaterialForm topicId={material.topic_id} material={material} onDone={() => setPanel(null)} />}
          {panel === "access" && (
            <AccessEditor
              kind="material"
              id={material.id}
              mode={material.access_mode}
              granted={granted}
              students={ctx.students}
              groupName={ctx.group}
              parentNote={`Students also need access to “${topicTitle}” and its unit.`}
              onDone={() => setPanel(null)}
            />
          )}
          {panel === "delete" && (
            <DeleteConfirm
              kind="material"
              id={material.id}
              what={`“${material.title}”`}
              contents={(material.storage_path ? "The uploaded file will be deleted too." : "") + refWarning(ctx.refs[material.id]) || undefined}
              onCancel={() => setPanel(null)}
            />
          )}
        </PanelBox>
      )}
    </li>
  );
}

/* ─── Shared row ─── */

function Row({
  icon: Icon,
  open,
  onToggle,
  eyebrow,
  title,
  badges,
  meta,
  access,
  kind,
  id,
  published,
  isFirst,
  isLast,
  panel,
  setPanel,
  addLabel,
  compact,
  preview,
  links,
}: {
  links?: React.ReactNode;
  icon: LucideIcon;
  open?: boolean;
  onToggle?: () => void;
  eyebrow?: string;
  title: string;
  badges: React.ReactNode;
  meta: string[];
  access: { mode: AccessMode; count: number };
  kind: ContentKind;
  id: string;
  published: boolean;
  isFirst: boolean;
  isLast: boolean;
  panel: Panel;
  setPanel: (p: Panel) => void;
  addLabel?: string;
  compact?: boolean;
  preview?: string;
}) {
  const toggle = (p: Exclude<Panel, null>) => setPanel(panel === p ? null : p);
  const restricted = access.mode === "selected";

  return (
    <div className={cn("flex flex-col gap-3 lg:flex-row lg:items-center", compact ? "px-3 py-2.5" : "p-4")}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-label={`${open ? "Collapse" : "Expand"} ${title}`}
            className="mt-0.5 rounded-md p-0.5 text-orbit-text-muted hover:bg-orbit-panel hover:text-orbit-text"
          >
            <ChevronRight size={18} className={cn("transition-transform duration-200", open && "rotate-90")} />
          </button>
        ) : (
          <span className="w-[22px]" aria-hidden="true" />
        )}
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-lg bg-orbit-panel-hover",
            compact ? "h-8 w-8" : "h-9 w-9",
          )}
        >
          <Icon size={compact ? 15 : 17} strokeWidth={1.75} className="text-orbit-primary" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          {eyebrow && <p className="text-xs font-medium text-orbit-primary-text">{eyebrow}</p>}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <button
              type="button"
              onClick={onToggle}
              className={cn("text-left font-medium text-orbit-text", !onToggle && "cursor-default")}
            >
              {title}
            </button>
            {badges}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-orbit-text-muted">
            {meta.map((m) => (
              <span key={m}>{m} ·</span>
            ))}
            <span className={cn("inline-flex items-center gap-1", restricted && "font-medium text-orbit-primary-text")}>
              <Users size={12} aria-hidden="true" /> {accessSummary(access.mode, access.count)}
            </span>
            {preview && (
              <>
                <span>·</span>
                <a
                  href={preview}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-orbit-primary-text hover:underline"
                >
                  Preview
                </a>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 pl-[34px] lg:pl-0">
        {addLabel && (
          <button
            type="button"
            onClick={() => toggle("add")}
            aria-expanded={panel === "add"}
            className={cn(
              "inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium transition-colors",
              panel === "add"
                ? "border-orbit-primary bg-orbit-panel-hover text-orbit-primary-hover"
                : "border-orbit-border bg-white text-orbit-primary-text hover:bg-orbit-panel",
            )}
          >
            <Plus size={14} aria-hidden="true" /> {addLabel}
          </button>
        )}
        {links}
        <PublishButton kind={kind} id={id} published={published} title={title} />
        <form action={moveAction}>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="direction" value="up" />
          <button type="submit" className={iconButton} disabled={isFirst} aria-label={`Move ${title} up`} title="Move up">
            <ArrowUp size={14} />
          </button>
        </form>
        <form action={moveAction}>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="direction" value="down" />
          <button type="submit" className={iconButton} disabled={isLast} aria-label={`Move ${title} down`} title="Move down">
            <ArrowDown size={14} />
          </button>
        </form>
        <PanelButton
          icon={Pencil}
          label={`Edit ${title}`}
          title="Edit"
          active={panel === "edit"}
          onClick={() => toggle("edit")}
        />
        <PanelButton
          icon={Users}
          label={`Manage access to ${title}`}
          title="Manage access"
          active={panel === "access"}
          onClick={() => toggle("access")}
        />
        <PanelButton
          icon={Trash2}
          label={`Delete ${title}`}
          title="Delete"
          active={panel === "delete"}
          onClick={() => toggle("delete")}
          danger
        />
      </div>
    </div>
  );
}

function PanelButton({
  icon: Icon,
  label,
  title,
  active,
  onClick,
  danger,
}: {
  icon: LucideIcon;
  label: string;
  title: string;
  active: boolean;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={active}
      title={title}
      className={cn(
        iconButton,
        active && "border-orbit-primary bg-orbit-panel-hover text-orbit-primary-hover",
        danger && "hover:border-orbit-error/50 hover:bg-orbit-error-muted hover:text-orbit-error",
      )}
    >
      <Icon size={14} />
    </button>
  );
}

function PublishButton({ kind, id, published, title }: { kind: ContentKind; id: string; published: boolean; title: string }) {
  return (
    <form action={setPublishedAction}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="publish" value={String(!published)} />
      <button
        type="submit"
        aria-label={published ? `Unpublish ${title}` : `Publish ${title}`}
        title={published ? "Unpublish (hide from students)" : "Publish"}
        className={cn(
          "inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium transition-colors",
          published
            ? "border-orbit-border bg-white text-orbit-text-secondary hover:bg-orbit-panel"
            : "border-transparent bg-orbit-primary text-white hover:bg-orbit-primary-hover",
        )}
      >
        {published ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
        {published ? "Unpublish" : "Publish"}
      </button>
    </form>
  );
}

function StatusBadges({ published, placeholder, review }: { published: boolean; placeholder?: boolean; review?: boolean }) {
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {published ? <Badge tone="success">Published</Badge> : <Badge>Draft</Badge>}
      {placeholder && <Badge>Coming soon</Badge>}
      {review && <Badge tone="warning">Needs spec review</Badge>}
    </span>
  );
}

function PanelBox({ children }: { children: React.ReactNode }) {
  return <div className="animate-rise border-t border-orbit-border-subtle bg-white p-4 sm:p-5">{children}</div>;
}

function EmptyChild({ label, action, onAdd }: { label: string; action: string; onAdd: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-orbit-border bg-white px-4 py-3 text-sm text-orbit-text-muted">
      {label}
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-1 font-medium text-orbit-primary-text hover:text-orbit-primary-hover"
      >
        <Plus size={14} aria-hidden="true" /> {action}
      </button>
    </div>
  );
}

/* ─── Forms ─── */

function useFormAction(action: (prev: FormState, fd: FormData) => Promise<FormState>, onOk?: () => void) {
  const flash = useContext(FlashContext);
  return useActionState(async (prev: FormState, fd: FormData) => {
    const result = await action(prev, fd);
    if (result?.ok) {
      if (result.message) flash(result.message);
      onOk?.();
    }
    return result;
  }, undefined);
}

function FormButtons({ pending, label, onCancel }: { pending: boolean; label: string; onCancel?: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-40">
        <SubmitButton pending={pending}>{pending ? "Saving…" : label}</SubmitButton>
      </div>
      {onCancel && (
        <button type="button" onClick={onCancel} className="btn-secondary rounded-xl px-4 py-3 text-sm font-medium">
          Cancel
        </button>
      )}
    </div>
  );
}

function UnitCreateForm({
  students,
  curriculum,
  onCancel,
}: {
  students: PickerStudent[];
  curriculum?: { id: string; name: string };
  onCancel: () => void;
}) {
  const [state, action, pending] = useFormAction(createUnitAction, onCancel);
  const e = state?.fieldErrors;
  return (
    <form action={action} className="space-y-4">
      {curriculum && <input type="hidden" name="curriculumId" value={curriculum.id} />}
      <FormMessage ok={state?.ok} message={state?.message} />
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <Field label="Label (optional)" name="code" placeholder="e.g. Unit 7" errors={e?.code} />
        <Field label="Title" name="title" placeholder="e.g. Waves and Electricity" required errors={e?.title} />
      </div>
      <TextArea label="Description (optional)" name="description" rows={2} errors={e?.description} />
      <Checkbox name="isPublished" label="Publish now" hint="Leave unticked to keep it as a draft while you add content." />
      <AccessPicker students={students} groupName={curriculum?.name} />
      <FormButtons pending={pending} label="Add unit" onCancel={onCancel} />
    </form>
  );
}

function UnitEditForm({ unit, onDone }: { unit: AdminUnit; onDone: () => void }) {
  const [state, action, pending] = useFormAction(updateUnitAction, onDone);
  const e = state?.fieldErrors;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="unitId" value={unit.id} />
      <FormMessage ok={state?.ok} message={state?.message} />
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <Field label="Label" name="code" defaultValue={unit.code} required errors={e?.code} />
        <Field label="Title" name="title" defaultValue={unit.title} required errors={e?.title} />
      </div>
      <TextArea
        label="Description (optional)"
        name="description"
        rows={2}
        defaultValue={unit.description}
        errors={e?.description}
      />
      <div className="grid gap-3 md:grid-cols-3">
        <Checkbox
          name="isPublished"
          label="Published"
          hint="Visible to students with access."
          defaultChecked={unit.is_published}
        />
        <Checkbox
          name="isPlaceholder"
          label="Coming soon"
          hint="Students see the unit but no content."
          defaultChecked={unit.is_placeholder}
        />
        <Checkbox
          name="reviewed"
          label="Checked against the spec"
          hint="Clears the review flag."
          defaultChecked={!unit.needs_review}
        />
      </div>
      <FormButtons pending={pending} label="Save unit" onCancel={onDone} />
    </form>
  );
}

function TopicCreateForm({
  unitId,
  students,
  group,
  onCancel,
}: {
  unitId: string;
  students: PickerStudent[];
  group?: string;
  onCancel: () => void;
}) {
  const [state, action, pending] = useFormAction(createTopicAction, onCancel);
  const e = state?.fieldErrors;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="unitId" value={unitId} />
      <FormMessage ok={state?.ok} message={state?.message} />
      <Field label="Title" name="title" placeholder="e.g. Momentum and impulse" required errors={e?.title} />
      <TextArea label="Description (optional)" name="description" rows={2} errors={e?.description} />
      <Checkbox name="isPublished" label="Publish now" />
      <AccessPicker students={students} groupName={group} intro="Students also need access to the unit." />
      <FormButtons pending={pending} label="Add subtopic" onCancel={onCancel} />
    </form>
  );
}

function TopicEditForm({ topic, onDone }: { topic: AdminTopic; onDone: () => void }) {
  const [state, action, pending] = useFormAction(updateTopicAction, onDone);
  const e = state?.fieldErrors;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="topicId" value={topic.id} />
      <FormMessage ok={state?.ok} message={state?.message} />
      <Field label="Title" name="title" defaultValue={topic.title} required errors={e?.title} />
      <TextArea
        label="Description (optional)"
        name="description"
        rows={2}
        defaultValue={topic.description}
        errors={e?.description}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Checkbox name="isPublished" label="Published" defaultChecked={topic.is_published} />
        <Checkbox name="reviewed" label="Checked against the spec" defaultChecked={!topic.needs_review} />
      </div>
      <FormButtons pending={pending} label="Save subtopic" onCancel={onDone} />
    </form>
  );
}

function DeleteConfirm({
  kind,
  id,
  what,
  contents,
  onCancel,
}: {
  kind: ContentKind;
  id: string;
  what: string;
  contents?: string;
  onCancel: () => void;
}) {
  const [state, action, pending] = useFormAction(deleteAction);
  return (
    <form action={action} className="rounded-xl border border-[#f6d3ce] bg-orbit-error-muted p-4">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <p className="text-sm font-medium text-orbit-error">Delete {what} permanently?</p>
      <p className="mt-1 text-sm text-orbit-text-secondary">
        {contents ?? "This can't be undone."} {contents && "This can't be undone."} Students will lose access immediately.
      </p>
      {state?.message && !state.ok && <p className="mt-2 text-sm text-orbit-error">{state.message}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-orbit-error px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Deleting…" : "Delete permanently"}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary rounded-xl px-4 py-2.5 text-sm font-medium">
          Cancel
        </button>
      </div>
    </form>
  );
}
