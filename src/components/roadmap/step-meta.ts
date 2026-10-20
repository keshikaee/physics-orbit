import { BookOpen, FileText, Flag, GraduationCap, ListChecks, type LucideIcon } from "lucide-react";
import type { NodeKind } from "@/types";
import type { StepState } from "@/lib/roadmap/progress";

export const STEP_KINDS: { kind: NodeKind; label: string; icon: LucideIcon; hint: string }[] = [
  { kind: "lesson", label: "Lesson", icon: BookOpen, hint: "A lesson or subtopic" },
  { kind: "resource", label: "Resource", icon: FileText, hint: "PDFs, videos, links or notes" },
  { kind: "quiz", label: "Quiz", icon: ListChecks, hint: "A short assessment" },
  { kind: "milestone", label: "Milestone", icon: Flag, hint: "A significant stage" },
  { kind: "final", label: "Final assessment", icon: GraduationCap, hint: "End-of-unit assessment" },
];
export const STEP_KIND = Object.fromEntries(STEP_KINDS.map((k) => [k.kind, k])) as Record<NodeKind, (typeof STEP_KINDS)[number]>;

export const STATE_LABEL: Record<StepState, string> = {
  completed: "Completed",
  in_progress: "In progress",
  not_started: "Not started",
  locked: "Locked",
};

/** Card colours per state — thin borders, soft fills, no glow. */
export const STATE_STYLE: Record<StepState, string> = {
  not_started: "border-orbit-border bg-white",
  in_progress: "border-[#b9d9c4] bg-orbit-panel",
  completed: "border-orbit-primary bg-orbit-panel-hover",
  locked: "border-dashed border-orbit-border bg-orbit-canvas text-orbit-text-muted",
};
