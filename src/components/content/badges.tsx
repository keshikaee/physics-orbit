import { cn } from "@/lib/utils";

const tones = {
  success: "border-transparent bg-orbit-primary-muted text-orbit-primary-hover",
  warning: "border-transparent bg-orbit-warning-muted text-orbit-warning",
  muted: "border-orbit-border bg-white text-orbit-text-secondary",
} as const;

export function Badge({ tone = "muted", children }: { tone?: keyof typeof tones; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}

/** Status badges shown to staff for any unit/topic. */
export function ContentStatusBadges({
  isPublished,
  isPlaceholder,
  needsReview,
}: {
  isPublished: boolean;
  isPlaceholder?: boolean;
  needsReview?: boolean;
}) {
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {isPublished ? <Badge tone="success">Published</Badge> : <Badge>Draft</Badge>}
      {isPlaceholder && <Badge>Placeholder</Badge>}
      {needsReview && <Badge tone="warning">Needs spec review</Badge>}
    </span>
  );
}
