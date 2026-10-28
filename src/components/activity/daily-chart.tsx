import type { DailyPoint } from "@/lib/activity/analytics";
import { formatDay } from "@/lib/activity/format";

/**
 * Single-series daily bar chart (no JS): one bar per day, brand green,
 * baseline-anchored with 4px rounded tops and a 2px gap. Hover or focus a
 * bar for that day's exact numbers; the page also shows them as tables.
 */
export function DailyChart({
  points,
  measure,
  title,
  description,
}: {
  points: DailyPoint[];
  measure: "students" | "interactions";
  title: string;
  description?: string;
}) {
  const values = points.map((p) => p[measure]);
  const max = Math.max(...values, 0);
  // A round top value for the axis, so the scale reads naturally.
  const top = max <= 5 ? Math.max(max, 1) : Math.ceil(max / 5) * 5;
  const total = values.reduce((a, b) => a + b, 0);
  const tickIdx = [0, Math.floor((points.length - 1) / 2), points.length - 1];

  return (
    <figure className="rounded-2xl border border-orbit-border bg-white p-5 shadow-[var(--shadow-card)]">
      <figcaption className="mb-4">
        <span className="block font-semibold text-orbit-text">{title}</span>
        {description && <span className="mt-0.5 block text-sm text-orbit-text-secondary">{description}</span>}
      </figcaption>

      {total === 0 ? (
        <p className="rounded-xl bg-orbit-panel p-6 text-center text-sm text-orbit-text-secondary">No activity recorded in this period.</p>
      ) : (
        <div className="flex gap-2">
          <div className="flex h-40 flex-col justify-between pb-px text-right text-[11px] tabular-nums text-orbit-text-muted" aria-hidden="true">
            <span>{top}</span>
            <span>0</span>
          </div>
          <div className="min-w-0 flex-1">
            <div
              role="list"
              aria-label={title}
              className="relative flex h-40 items-end gap-[2px] border-b border-orbit-border"
              style={{
                backgroundImage: "linear-gradient(to bottom, var(--orbit-border-subtle) 1px, transparent 1px)",
                backgroundSize: "100% 50%",
              }}
            >
              {points.map((p) => {
                const v = p[measure];
                return (
                  <div
                    key={p.day}
                    role="listitem"
                    tabIndex={0}
                    aria-label={`${formatDay(p.day)}: ${p.students} active ${p.students === 1 ? "student" : "students"}, ${p.interactions} ${p.interactions === 1 ? "interaction" : "interactions"}`}
                    className="group relative flex h-full min-w-0 flex-1 items-end outline-none"
                  >
                    {/* Hit target is the full column; the mark is the bar. */}
                    <div
                      className="w-full rounded-t-[4px] bg-orbit-primary transition-opacity group-hover:opacity-80 group-focus-visible:opacity-80"
                      style={{ height: v ? `max(${(v / top) * 100}%, 3px)` : 0 }}
                    />
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-orbit-border bg-white px-2.5 py-1.5 text-xs shadow-md group-hover:block group-focus-visible:block">
                      <span className="block font-medium text-orbit-text">{formatDay(p.day)}</span>
                      <span className="block text-orbit-text-secondary">
                        {p.students} active {p.students === 1 ? "student" : "students"}
                      </span>
                      <span className="block text-orbit-text-secondary">
                        {p.interactions} {p.interactions === 1 ? "interaction" : "interactions"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="relative mt-1.5 h-4 text-[11px] text-orbit-text-muted" aria-hidden="true">
              {tickIdx.map((i, n) => (
                <span
                  key={n}
                  className="absolute top-0 whitespace-nowrap"
                  style={
                    n === 0
                      ? { left: 0 }
                      : n === 2
                        ? { right: 0 }
                        : { left: `${((i + 0.5) / points.length) * 100}%`, transform: "translateX(-50%)" }
                  }
                >
                  {formatDay(points[i]!.day, false)}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </figure>
  );
}
