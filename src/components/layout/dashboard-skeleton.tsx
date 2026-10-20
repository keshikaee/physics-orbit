export function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-5 sm:p-8" aria-busy="true" aria-label="Loading">
      <div className="h-48 rounded-2xl bg-orbit-panel animate-pulse" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl border border-orbit-border bg-white animate-pulse" />
        ))}
      </div>
      <div className="h-64 rounded-2xl border border-orbit-border bg-white animate-pulse" />
    </div>
  );
}

/** Same footprint as the app nav, shown while the current URL is resolved. */
export function SidebarSkeleton() {
  return (
    <>
      <div className="md:hidden h-14 shrink-0 border-b border-orbit-border bg-white" aria-hidden="true" />
      <aside className="hidden md:flex w-64 shrink-0 border-r border-orbit-border bg-white" aria-hidden="true" />
    </>
  );
}
