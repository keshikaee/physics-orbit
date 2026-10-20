import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  children,
  compact,
}: {
  icon: LucideIcon;
  title: string;
  children?: React.ReactNode;
  /** Smaller variant for side panels. */
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed border-orbit-border bg-white text-center",
        compact ? "px-4 py-6" : "px-6 py-14"
      )}
    >
      <div
        className={cn(
          "mx-auto inline-flex items-center justify-center rounded-full bg-orbit-panel-hover",
          compact ? "mb-3 h-10 w-10" : "mb-4 h-12 w-12"
        )}
      >
        <Icon size={compact ? 18 : 22} strokeWidth={1.75} className="text-orbit-primary" aria-hidden="true" />
      </div>
      <h2 className={cn("font-semibold text-orbit-text", compact && "text-sm")}>{title}</h2>
      {children && (
        <div className={cn("mx-auto mt-1.5 max-w-md text-orbit-text-secondary", compact ? "text-xs" : "text-sm")}>
          {children}
        </div>
      )}
    </div>
  );
}
