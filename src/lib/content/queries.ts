import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ContentGrant, Course, Curriculum, Material, StudentDetailsRow, Topic, Unit, UserProfile } from "@/types";

/*
 * Read helpers for the content hierarchy:
 *   Curriculum → Course (one per curriculum) → Unit → Subtopic → Materials.
 * RLS decides what each user can see: students get only published rows in
 * their own curriculum that they are allowed to access (and whose parents
 * they can access); admins get everything.
 */

export type UnitSummary = Unit & { topic_count: number };
export type TopicSummary = Topic & { material_count: number };

type CountRel = { count: number }[] | null;
const countOf = (rel: CountRel) => rel?.[0]?.count ?? 0;
const byOrder = <T extends { order_index: number }>(a: T, b: T) => a.order_index - b.order_index;

/* ─── Student views ─── */

/** The course of a curriculum, with the units the caller may see. */
export async function getCourseWithUnits(curriculumId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .select("*, units(*, topics(count))")
    .eq("curriculum_id", curriculumId)
    .maybeSingle();

  if (error) throw new Error(`Could not load course: ${error.message}`);
  if (!data) return null;

  const { units, ...course } = data as Course & { units: (Unit & { topics: CountRel })[] };
  return {
    course: course as Course,
    units: units
      .map(({ topics, ...u }) => ({ ...u, topic_count: countOf(topics) }))
      .sort(byOrder) as UnitSummary[],
  };
}

export async function getUnitWithTopics(unitSlug: string, curriculumId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("units")
    .select("*, courses!inner(curriculum_id), topics(*, materials(count))")
    .eq("slug", unitSlug)
    .eq("courses.curriculum_id", curriculumId)
    .maybeSingle();

  if (error) throw new Error(`Could not load unit: ${error.message}`);
  if (!data) return null;

  const { topics, ...unit } = data as Unit & {
    courses?: unknown;
    topics: (Topic & { materials: CountRel })[];
  };
  delete unit.courses; // join used only for filtering
  return {
    unit: unit as Unit,
    topics: topics
      .map(({ materials, ...t }) => ({ ...t, material_count: countOf(materials) }))
      .sort(byOrder) as TopicSummary[],
  };
}

export async function getTopicWithMaterials(unitSlug: string, topicSlug: string, curriculumId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("units")
    .select("*, courses!inner(curriculum_id), topics!inner(*, materials(*))")
    .eq("slug", unitSlug)
    .eq("courses.curriculum_id", curriculumId)
    .eq("topics.slug", topicSlug)
    .maybeSingle();

  if (error) throw new Error(`Could not load subtopic: ${error.message}`);
  if (!data) return null;

  const { topics, ...unit } = data as Unit & {
    courses?: unknown;
    topics: (Topic & { materials: Material[] })[];
  };
  delete unit.courses;
  const topicRow = topics[0];
  if (!topicRow) return null;
  const { materials, ...topic } = topicRow;
  return { unit: unit as Unit, topic: topic as Topic, materials: materials.sort(byOrder) };
}

/** One material with its parents — null if missing or not accessible to the caller. */
export async function getMaterial(materialId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("materials")
    .select("*, topics!inner(id, slug, title, units!inner(id, slug, code, title))")
    .eq("id", materialId)
    .maybeSingle();

  if (error) throw new Error(`Could not load material: ${error.message}`);
  if (!data) return null;

  const { topics, ...material } = data as Material & {
    topics: Pick<Topic, "id" | "slug" | "title"> & { units: Pick<Unit, "id" | "slug" | "code" | "title"> };
  };
  const { units, ...topic } = topics;
  return { material: material as Material, topic, unit: units };
}

/* ─── Admin views ─── */

export type AdminTopic = Topic & { materials: Material[] };
export type AdminUnit = Unit & { topics: AdminTopic[] };
export type StudentSummary = Pick<UserProfile, "id" | "full_name" | "email" | "status" | "created_at" | "curriculum_id"> &
  Pick<StudentDetailsRow, "institute" | "district">;
export type StudentProfile = StudentSummary & StudentDetailsRow;
export type CurriculumSummary = Pick<Curriculum, "id" | "slug" | "name" | "description" | "status" | "order_index"> & {
  courseId: string | null;
  unitCount: number;
};

/** All curricula with their course and unit count (admin). */
export async function getCurricula(): Promise<CurriculumSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("curricula")
    .select("id, slug, name, description, status, order_index, courses(id, units(count))")
    .order("order_index");
  if (error) throw new Error(`Could not load curricula: ${error.message}`);
  return (data as unknown as (Omit<CurriculumSummary, "courseId" | "unitCount"> & { courses: { id: string; units: CountRel }[] | { id: string; units: CountRel } | null })[]).map(
    ({ courses, ...c }) => {
      const course = Array.isArray(courses) ? courses[0] : courses;
      return { ...c, courseId: course?.id ?? null, unitCount: course ? countOf(course.units) : 0 };
    },
  );
}

/** PostgREST caps responses (1000 rows by default), so page through big tables. */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const size = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < size) return rows;
  }
}

/**
 * One curriculum's course tree, every grant, and that curriculum's students —
 * for the admin content and access screens.
 */
export async function getAdminContent(curriculumId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .select("*, units(*, topics(*, materials(*)))")
    .eq("curriculum_id", curriculumId)
    .maybeSingle();
  if (error) throw new Error(`Could not load content: ${error.message}`);

  const [grants, students] = await Promise.all([
    fetchAll<ContentGrant>((from, to) =>
      supabase.from("content_grants").select("student_id, unit_id, topic_id, material_id, node_id").range(from, to)
    ),
    getStudents(curriculumId),
  ]);

  if (!data) return { course: null, units: [] as AdminUnit[], grants, students };
  const { units, ...course } = data as Course & { units: AdminUnit[] };
  for (const u of units) {
    u.topics.sort(byOrder);
    for (const t of u.topics) t.materials.sort(byOrder);
  }
  return { course: course as Course, units: units.sort(byOrder), grants, students };
}

const STUDENT_COLUMNS = "id, full_name, email, status, created_at, curriculum_id, institute, district";

/** Students, optionally only one curriculum's (admin). */
export async function getStudents(curriculumId?: string): Promise<StudentSummary[]> {
  const supabase = await createClient();
  return fetchAll<StudentSummary>((from, to) => {
    let q = supabase.from("profiles").select(STUDENT_COLUMNS).eq("role", "student");
    if (curriculumId) q = q.eq("curriculum_id", curriculumId);
    return q.order("full_name").range(from, to);
  });
}

/** One student's full profile, including personal details (admin only — RLS). */
export async function getStudent(studentId: string): Promise<StudentProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(`${STUDENT_COLUMNS}, date_of_birth, gender, phone, whatsapp_available, privacy_consent_at`)
    .eq("id", studentId)
    .eq("role", "student")
    .maybeSingle();
  if (error) throw new Error(`Could not load student: ${error.message}`);
  return data as StudentProfile | null;
}

/** The curriculum a unit belongs to (admin). */
export async function getUnitCurriculum(unitId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("units")
    .select("courses!inner(curricula!inner(id, slug, name))")
    .eq("id", unitId)
    .maybeSingle();
  if (error) throw new Error(`Could not load unit: ${error.message}`);
  const row = data as unknown as { courses: { curricula: Pick<Curriculum, "id" | "slug" | "name"> } } | null;
  return row?.courses.curricula ?? null;
}
