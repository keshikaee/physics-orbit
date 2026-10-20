import { FileText, Link2, NotebookPen, PlayCircle, type LucideIcon } from "lucide-react";
import type { MaterialKind } from "@/types";

/* Icon + label per material type — safe to import from server and client components. */
export const MATERIAL_ICONS: Record<MaterialKind, { icon: LucideIcon; label: string }> = {
  pdf: { icon: FileText, label: "PDF" },
  video: { icon: PlayCircle, label: "Video" },
  link: { icon: Link2, label: "Link" },
  note: { icon: NotebookPen, label: "Note" },
};
