/** First day page visits and sign-ins were recorded (the activity tracking migration). */
export const TRACKING_STARTED = "28 Oct 2026";

export function StatGrid({ stats }: { stats: { label: string; value: number | string; hint?: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="rounded-2xl border border-orbit-border bg-white p-4 shadow-[var(--shadow-card)]">
          <p className="text-2xl font-semibold tracking-tight tabular-nums text-orbit-text">{s.value}</p>
          <p className="mt-0.5 text-sm text-orbit-text-muted">{s.label}</p>
          {s.hint && <p className="mt-1 text-xs text-orbit-text-muted">{s.hint}</p>}
        </div>
      ))}
    </div>
  );
}

export function TrackingNote() {
  return (
    <p className="border-t border-orbit-border-subtle px-5 py-2.5 text-xs text-orbit-text-muted">
      Sign-ins and page visits are recorded from {TRACKING_STARTED}; repeat visits to the same page within 10 minutes count once. Quiz
      submissions and completed steps include earlier history.
    </p>
  );
}
