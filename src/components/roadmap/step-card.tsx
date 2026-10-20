"use client";

import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { CheckCircle2, Lock, Users } from "lucide-react";
import type { NodeKind } from "@/types";
import type { StepState } from "@/lib/roadmap/progress";
import { cn } from "@/lib/utils";
import { STATE_LABEL, STATE_STYLE, STEP_KIND } from "./step-meta";

/*
 * One roadmap step as a React Flow node. The same card is used in the
 * admin builder (editable, with configuration hints) and the student
 * viewer (read-only, coloured by the student's own progress).
 */

export type StepCardData = {
  kind: NodeKind;
  title: string;
  /** Student view / preview: progress state. Builder: undefined. */
  state?: StepState;
  /** Restricted step shown as locked: title only. */
  restricted?: boolean;
  optional?: boolean;
  /** Builder hints. */
  meta?: string[];
  lockedByPrereqs?: boolean;
  limited?: boolean;
  editable?: boolean;
};
export type StepCardNode = Node<StepCardData, "step">;

const handle = "!h-2.5 !w-2.5 !rounded-full !border-2 !border-white !bg-[#9fb8a8]";

function StepCardBase({ data, selected }: NodeProps<StepCardNode>) {
  const { icon: Icon, label } = STEP_KIND[data.kind];
  const state = data.state;
  const locked = state === "locked";
  const done = state === "completed";
  const connectable = Boolean(data.editable);

  return (
    <div
      className={cn(
        "w-[220px] rounded-2xl border px-3.5 py-3 text-left shadow-[0_1px_2px_rgba(23,43,34,0.05)] transition-[background-color,border-color,box-shadow] duration-500",
        state ? STATE_STYLE[state] : "border-orbit-border bg-white",
        selected && "ring-4 ring-orbit-primary/15 border-orbit-primary",
        data.kind === "final" && !state && "border-orbit-primary/50",
      )}
    >
      <Handle type="target" position={Position.Left} isConnectable={connectable} className={cn(handle, !connectable && "!opacity-0")} />

      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
            done ? "bg-orbit-primary text-white" : locked ? "bg-white text-orbit-text-muted" : "bg-orbit-panel-hover text-orbit-primary",
          )}
        >
          {done ? (
            <CheckCircle2 size={15} strokeWidth={2.25} aria-hidden="true" />
          ) : locked ? (
            <Lock size={14} aria-hidden="true" />
          ) : (
            <Icon size={15} strokeWidth={1.75} aria-hidden="true" />
          )}
        </span>
        <span className={cn("min-w-0 flex-1 truncate text-[11px] font-medium uppercase tracking-wide", locked ? "text-orbit-text-muted" : "text-orbit-primary-text")}>
          {label}
          {data.optional && <span className="font-normal normal-case tracking-normal text-orbit-text-muted"> · optional</span>}
        </span>
        {data.lockedByPrereqs && !state && <Lock size={13} className="shrink-0 text-orbit-text-muted" aria-label="Locked until earlier steps are done" />}
        {data.limited && !state && <Users size={13} className="shrink-0 text-orbit-primary" aria-label="Limited to selected students" />}
      </div>

      <p className={cn("mt-2 line-clamp-2 text-sm font-semibold leading-snug", locked ? "text-orbit-text-muted" : "text-orbit-text")}>{data.title}</p>

      {state && (
        <p className={cn("mt-1.5 text-xs", done ? "font-medium text-orbit-primary-hover" : "text-orbit-text-secondary")}>
          {data.restricted ? "No access" : STATE_LABEL[state]}
        </p>
      )}
      {!state && data.meta && data.meta.length > 0 && <p className="mt-1.5 truncate text-xs text-orbit-text-muted">{data.meta.join(" · ")}</p>}

      <Handle type="source" position={Position.Right} isConnectable={connectable} className={cn(handle, !connectable && "!opacity-0")} />
    </div>
  );
}

export const StepCard = memo(StepCardBase);
export const stepNodeTypes = { step: StepCard };
