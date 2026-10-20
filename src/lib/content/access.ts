import type { AccessMode, ContentGrant, ContentKind } from "@/types";

/** Anything that can carry per-student grants: content items and roadmap steps. */
export type GrantKind = ContentKind | "node";

/*
 * Pure access rules, mirroring the RLS policies in
 * supabase/migrations/*_admin_materials_access.sql. The database is the
 * authority; these helpers only explain the same rules in the admin UI.
 */

export interface AccessControlled {
  id: string;
  access_mode: AccessMode;
  is_published: boolean;
}

/** item key → student ids granted on that item. */
export type GrantIndex = Map<string, Set<string>>;

export const grantKey = (kind: GrantKind, id: string) => `${kind}:${id}`;

export function indexGrants(grants: ContentGrant[]): GrantIndex {
  const index: GrantIndex = new Map();
  for (const g of grants) {
    const key = g.unit_id
      ? grantKey("unit", g.unit_id)
      : g.topic_id
        ? grantKey("topic", g.topic_id)
        : g.material_id
          ? grantKey("material", g.material_id)
          : g.node_id
            ? grantKey("node", g.node_id)
            : null;
    if (!key) continue;
    if (!index.has(key)) index.set(key, new Set());
    index.get(key)!.add(g.student_id);
  }
  return index;
}

export function grantedStudents(index: GrantIndex, kind: GrantKind, id: string): string[] {
  return [...(index.get(grantKey(kind, id)) ?? [])];
}

/** Is the student allowed on this one item, ignoring its parents? */
export function allowedAt(index: GrantIndex, kind: GrantKind, item: AccessControlled, studentId: string) {
  return item.access_mode === "all" || (index.get(grantKey(kind, item.id))?.has(studentId) ?? false);
}

export interface Visibility {
  /** Allowed at this level (what the admin toggles). */
  allowed: boolean;
  /** Actually visible to the student: allowed + published here and at every parent. */
  visible: boolean;
  /** Why it's hidden, when allowed but not visible. */
  blockedBy: "parent" | "unpublished" | null;
}

/** Combine one level with its parent's visibility (parent restrictions always win). */
export function visibility(allowed: boolean, isPublished: boolean, parent: Visibility | null): Visibility {
  const parentVisible = parent ? parent.visible : true;
  const visible = allowed && isPublished && parentVisible;
  return {
    allowed,
    visible,
    blockedBy: allowed && !visible ? (!parentVisible ? "parent" : "unpublished") : null,
  };
}

export function accessSummary(mode: AccessMode, grantedCount: number) {
  if (mode === "all") return "All students";
  if (grantedCount === 0) return "No students";
  return grantedCount === 1 ? "1 student" : `${grantedCount} students`;
}

/**
 * A roadmap step's visibility for one student (mirrors public.can_view_node):
 * the roadmap must be published, the step allowed, its linked subtopic
 * visible, and — when it links materials — at least one of them visible.
 */
export function stepVisibility(
  allowed: boolean,
  roadmapPublished: boolean,
  unit: Visibility,
  linkedTopic: Visibility | null,
  linkedMaterials: Visibility[],
): Visibility {
  const parent: Visibility = {
    allowed: true,
    visible:
      unit.visible &&
      (linkedTopic ? linkedTopic.visible : true) &&
      (linkedMaterials.length === 0 || linkedMaterials.some((m) => m.visible)),
    blockedBy: null,
  };
  return visibility(allowed, roadmapPublished, parent);
}
