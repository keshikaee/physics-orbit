import Link from "next/link";
import {
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Layers,
  LayoutDashboard,
  LogIn,
  type LucideIcon,
} from "lucide-react";
import { dayKey, TARGETED_KINDS, type ActivityKind, type TimelineItem } from "@/lib/activity/analytics";
import { attemptResult, COMPLETION_SOURCE, EVENT_SENTENCES, formatDay, formatTime } from "@/lib/activity/format";

const EVENT_ICONS: Record<ActivityKind, LucideIcon> = {
  sign_in: LogIn,
  dashboard_view: LayoutDashboard,
  courses_view: BookOpen,
  unit_view: BookOpen,
  topic_view: Layers,
  material_view: FileText,
  quiz_view: ClipboardList,
};

/** One student's interactions, newest first, grouped by day. */
export function ActivityTimeline({ items, studentId }: { items: TimelineItem[]; studentId: string }) {
  if (items.length === 0) {
    return <p className="p-6 text-center text-sm text-orbit-text-muted">No interactions recorded yet.</p>;
  }

  const groups: { day: string; items: TimelineItem[] }[] = [];
  for (const item of items) {
    const day = dayKey(item.at);
    const last = groups.at(-1);
    if (last?.day === day) last.items.push(item);
    else groups.push({ day, items: [item] });
  }

  return (
    <div className="divide-y divide-orbit-border-subtle">
      {groups.map((g) => (
        <section key={g.day} aria-label={formatDay(g.day)} className="px-5 py-3">
          <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-orbit-text-muted">{formatDay(g.day)}</h3>
          <ul className="space-y-0.5">
            {g.items.map((item, i) => (
              <Row key={`${item.at}-${i}`} item={item} studentId={studentId} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Row({ item, studentId }: { item: TimelineItem; studentId: string }) {
  let Icon: LucideIcon;
  let content: React.ReactNode;

  if (item.type === "event") {
    Icon = EVENT_ICONS[item.kind];
    const targeted = (TARGETED_KINDS as readonly string[]).includes(item.kind);
    const name = item.title || (targeted ? "a deleted item" : "");
    content = (
      <>
        {EVENT_SENTENCES[item.kind]}
        {name && (
          <>
            {" "}
            {item.kind === "quiz_view" && item.quizId ? (
              <Link href={`/admin/quizzes/${item.quizId}`} className="font-medium text-orbit-text hover:underline">
                {name}
              </Link>
            ) : item.unitId && item.kind !== "unit_view" ? (
              <Link href={`/admin/content/${item.unitId}`} className="font-medium text-orbit-text hover:underline">
                {name}
              </Link>
            ) : (
              <span className="font-medium text-orbit-text">{name}</span>
            )}
          </>
        )}
      </>
    );
  } else if (item.type === "attempt") {
    const a = item.attempt;
    Icon = ClipboardCheck;
    content = (
      <>
        Submitted quiz{" "}
        <Link href={`/admin/students/${studentId}/attempts/${a.id}`} className="font-medium text-orbit-text hover:underline">
          {a.quiz_title ?? "a deleted quiz"}
        </Link>{" "}
        <span className="text-orbit-text-muted">
          (attempt {a.attempt_no}) · {attemptResult(a)}
        </span>
      </>
    );
  } else {
    const c = item.completion;
    Icon = CheckCircle2;
    content = (
      <>
        Completed step <span className="font-medium text-orbit-text">{c.node_title ?? "a deleted step"}</span>{" "}
        <span className="text-orbit-text-muted">· {COMPLETION_SOURCE[c.source]}</span>
      </>
    );
  }

  return (
    <li className="flex items-start gap-3 rounded-lg py-1.5 text-sm text-orbit-text-secondary">
      <span className="w-11 shrink-0 pt-px text-xs tabular-nums text-orbit-text-muted">{formatTime(item.at)}</span>
      <Icon size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-orbit-primary" aria-hidden="true" />
      <span className="min-w-0 flex-1">{content}</span>
    </li>
  );
}
