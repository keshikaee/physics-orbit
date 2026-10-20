import { isSupabaseConfigured } from "@/lib/supabase/env";

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-orbit-border bg-white p-6 shadow-[var(--shadow-lift)] sm:p-9">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-orbit-text mb-1.5">{title}</h1>
        <p className="text-sm text-orbit-text-secondary">{subtitle}</p>
      </div>

      {!isSupabaseConfigured() && (
        <div className="mb-4 rounded-lg border border-[#f5dfb3] bg-orbit-warning-muted p-3 text-sm text-orbit-warning">
          Setup required: Supabase is not configured, so accounts cannot be created or used yet.
        </div>
      )}

      {children}

      {footer && (
        <div className="mt-6 pt-6 border-t border-orbit-border text-center text-sm text-orbit-text-secondary">
          {footer}
        </div>
      )}
    </div>
  );
}
