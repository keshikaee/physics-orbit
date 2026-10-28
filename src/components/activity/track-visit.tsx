"use client";

import { useEffect } from "react";
import { recordVisitAction } from "@/lib/activity/actions";
import type { TARGETED_KINDS, UNTARGETED_KINDS } from "@/lib/activity/analytics";

type Props =
  | { kind: (typeof UNTARGETED_KINDS)[number]; target?: undefined }
  | { kind: (typeof TARGETED_KINDS)[number]; target: string };

/**
 * Invisible: records that the student opened this page. Runs in the browser
 * only (so link prefetching never counts as a visit). Renders nothing.
 */
export function TrackVisit({ kind, target }: Props) {
  useEffect(() => {
    void recordVisitAction({ kind, target: target ?? null });
  }, [kind, target]);
  return null;
}
