#!/usr/bin/env node
/**
 * Integration test for curricula: registration details, curriculum-scoped
 * access, curriculum-wide publishing, selected-student rules, and admin-only
 * curriculum changes.
 *
 *   npm run test:curriculum
 *
 * Runs against the Supabase project in .env.local with temporary,
 * pre-confirmed users and temporary units, and deletes everything it
 * created — even on failure. Existing users and content are never changed.
 */
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(url, serviceKey, noSession);
const run = randomUUID().slice(0, 8);
const password = `Cur-${randomUUID()}`;
const createdUsers = [];
const createdUnits = [];

let passed = 0;
let failed = 0;
function check(name, ok, detail = "") {
  if (ok) {
    passed++;
    console.log(`  ✔ ${name}`);
  } else {
    failed++;
    console.log(`  ✖ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}
function must({ data, error }, what) {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

const details = (curriculum, extra = {}) => ({
  curriculum,
  institute: "Royal College, Colombo",
  district: "colombo",
  date_of_birth: "2008-05-14",
  gender: "female",
  phone: "+94771234567",
  whatsapp_available: true,
  privacy_consent: "true",
  ...extra,
});

async function makeUser(label, metadata, role) {
  const email = `cur-${label}-${run}@example.com`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `CUR ${label} ${run}`, ...metadata },
  });
  if (error) throw new Error(`createUser(${label}): ${error.message}`);
  createdUsers.push(data.user.id);
  if (role) must(await service.from("profiles").update({ role }).eq("id", data.user.id), "role");
  const db = createClient(url, anonKey, noSession);
  must(await db.auth.signInWithPassword({ email, password }), `signIn(${label})`);
  return { id: data.user.id, db };
}

async function makeContent(ad, courseSlug, label) {
  const course = must(await service.from("courses").select("id").eq("slug", courseSlug).single(), "course");
  const unit = must(
    await ad
      .from("units")
      .insert({ course_id: course.id, slug: `cur-${label.toLowerCase()}-${run}`, code: label, title: `${label} unit ${run}`, order_index: 990, is_published: true, needs_review: false })
      .select("id")
      .single(),
    "unit",
  );
  createdUnits.push(unit.id);
  const topic = must(await ad.from("topics").insert({ unit_id: unit.id, slug: "t", title: `${label} topic`, is_published: true }).select("id").single(), "topic");
  const material = must(
    await ad.from("materials").insert({ topic_id: topic.id, kind: "link", title: `${label} link`, url: "https://example.com", is_published: true }).select("id").single(),
    "material",
  );
  const roadmap = must(await ad.from("roadmaps").insert({ unit_id: unit.id, is_published: true }).select("id, version").single(), "roadmap");
  const nodeId = randomUUID();
  must(
    await ad.rpc("save_roadmap", {
      p_roadmap: roadmap.id,
      p_version: roadmap.version,
      p_nodes: [{ id: nodeId, kind: "quiz", title: `${label} step`, description: "", x: 0, y: 0, topicId: topic.id, isRequired: true, completionRule: "all_required", minQuizzes: null, lockUntilPrereqs: false, materialIds: [], accessMode: "all", studentIds: [] }],
      p_edges: [],
    }),
    "roadmap save",
  );
  const quizId = randomUUID();
  const qid = randomUUID();
  must(
    await ad.rpc("save_quiz", {
      p_quiz: { id: quizId, nodeId, title: `${label} quiz`, description: "", passPercent: 50, maxAttempts: null, reveal: "after_submit", requirePass: true, isRequired: true, isPublished: true, questions: [{ id: qid, kind: "short", prompt: "Secret", marks: 1, key: { autoExact: true, acceptedAnswers: ["x"] } }] },
    }),
    "quiz",
  );
  return { unit: unit.id, topic: topic.id, material: material.id, node: nodeId, quiz: quizId, question: qid };
}

const seesUnit = async (u, id) => (await u.db.from("units").select("id").eq("id", id)).data?.length === 1;

async function main() {
  console.log(`\nCurriculum integration test (run ${run})\n`);

  console.log("Registration details");
  const admin = await makeUser("admin", {}, "admin");
  const ad = admin.db;
  const E1 = await makeUser("e1", { ...details("edexcel"), role: "admin" });
  const E2 = await makeUser("e2", details("edexcel"));
  const C1 = await makeUser("c1", details("cambridge"));
  const N = await makeUser("none", {});
  const bad = await makeUser("bad", details("narnia", { district: "atlantis", phone: "12345", date_of_birth: "not-a-date", gender: "robot" }));

  const { data: cur } = await service.from("curricula").select("id, slug");
  const cid = Object.fromEntries(cur.map((c) => [c.slug, c.id]));
  const e1p = must(await service.from("profiles").select("*").eq("id", E1.id).single(), "e1 profile");
  check(
    "registration saves curriculum, details and consent",
    e1p.curriculum_id === cid.edexcel && e1p.district === "colombo" && e1p.phone === "+94771234567" && e1p.whatsapp_available === true && e1p.date_of_birth === "2008-05-14" && Boolean(e1p.privacy_consent_at),
  );
  check("sign-up metadata still cannot choose a role", e1p.role === "student");
  const badp = must(await service.from("profiles").select("*").eq("id", bad.id).single(), "bad profile");
  check(
    "invalid details from a direct API call are dropped, not stored",
    badp.curriculum_id === null && badp.district === null && badp.phone === null && badp.date_of_birth === null && badp.gender === null,
  );
  check("anyone can read curriculum names", (await createClient(url, anonKey, noSession).from("curricula").select("slug")).data?.length >= 4);

  console.log("Curriculum-scoped content");
  const E = await makeContent(ad, "edexcel-ias-physics", "EDX");
  const C = await makeContent(ad, "cambridge-physics", "CAM");
  check("Edexcel student sees the Edexcel unit", await seesUnit(E1, E.unit));
  check("Edexcel student does NOT see the Cambridge unit", !(await seesUnit(E1, C.unit)));
  check("Cambridge student sees the Cambridge unit", await seesUnit(C1, C.unit));
  check("Cambridge student does NOT see the Edexcel unit", !(await seesUnit(C1, E.unit)));
  check("a student without a curriculum sees no units", (await N.db.from("units").select("id")).data.length === 0);
  const e1Courses = must(await E1.db.from("courses").select("slug"), "courses");
  check("students see only their own curriculum's course", e1Courses.length === 1 && e1Courses[0].slug === "edexcel-ias-physics");

  check("Cambridge student can't read an Edexcel material by id", (await C1.db.from("materials").select("id").eq("id", E.material)).data.length === 0);
  check("…or its roadmap step", (await C1.db.from("roadmap_nodes").select("id").eq("id", E.node)).data.length === 0);
  check("…or its quiz questions", (await C1.db.from("questions").select("id").eq("quiz_id", E.quiz)).data.length === 0);
  const cross = await C1.db.rpc("submit_quiz", { p_quiz: E.quiz, p_answers: {} });
  check("…or submit its quiz", Boolean(cross.error) && /not available/.test(cross.error.message));
  check("Edexcel student can open the Edexcel quiz", (await E1.db.from("questions").select("id").eq("quiz_id", E.quiz)).data.length === 1);

  const E3 = await makeUser("e3-later", details("edexcel"));
  check("'All Edexcel students' includes students who register later", await seesUnit(E3, E.unit));
  const { count: grantRows } = await service.from("content_grants").select("id", { count: "exact", head: true }).eq("unit_id", E.unit);
  check("…without copying per-student permission rows", grantRows === 0);

  must(await ad.from("units").update({ is_published: false }).eq("id", C.unit), "unpublish");
  check("unpublished content stays hidden from its own curriculum", !(await seesUnit(C1, C.unit)));
  must(await ad.from("units").update({ is_published: true }).eq("id", C.unit), "republish");

  console.log("Selected students");
  const crossGrant = await ad.rpc("set_content_access", { p_kind: "topic", p_id: E.topic, p_mode: "selected", p_students: [E1.id, C1.id] });
  check("selected-student access refuses students of another curriculum", Boolean(crossGrant.error));
  must(await ad.rpc("set_content_access", { p_kind: "topic", p_id: E.topic, p_mode: "selected", p_students: [E1.id] }), "select E1");
  check("a selected Edexcel student sees the restricted subtopic", (await E1.db.from("topics").select("id").eq("id", E.topic)).data.length === 1);
  check("another Edexcel student doesn't", (await E2.db.from("topics").select("id").eq("id", E.topic)).data.length === 0);
  must(await ad.rpc("set_student_access", { p_student: E2.id, p_kind: "unit", p_id: E.unit, p_allow: false }), "block E2");
  const unitGrants = must(await service.from("content_grants").select("student_id").eq("unit_id", E.unit), "grants");
  check(
    "blocking one student keeps every other Edexcel student — and no one else",
    unitGrants.length === 2 && unitGrants.every((g) => [E1.id, E3.id].includes(g.student_id)),
  );
  check("…and the blocked student loses the unit", !(await seesUnit(E2, E.unit)));

  console.log("Curriculum changes");
  const selfChange = await E1.db.from("profiles").update({ curriculum_id: cid.cambridge }).eq("id", E1.id);
  const afterSelf = must(await service.from("profiles").select("curriculum_id").eq("id", E1.id).single(), "e1");
  check("students cannot change their own curriculum", Boolean(selfChange.error) && afterSelf.curriculum_id === cid.edexcel);
  must(await N.db.from("profiles").update({ curriculum_id: cid.cambridge }).eq("id", N.id), "N chooses");
  check("a student without one can choose a curriculum once", await seesUnit(N, C.unit));
  const second = await N.db.from("profiles").update({ curriculum_id: cid.edexcel }).eq("id", N.id);
  check("…but not change it afterwards", Boolean(second.error));
  const otherRow = await E2.db.from("profiles").select("phone").eq("id", E1.id);
  check("students cannot read another student's details", otherRow.data.length === 0);
  const badPhone = await ad.from("profiles").update({ phone: "abc" }).eq("id", E1.id);
  check("the database rejects malformed phone numbers", Boolean(badPhone.error));

  // E1 has progress + a grant in Edexcel; admin moves them to Cambridge.
  must(await E1.db.rpc("submit_quiz", { p_quiz: E.quiz, p_answers: { [E.question]: { text: "x" } } }), "E1 attempt");
  const progressBefore = must(await service.from("node_completions").select("node_id").eq("student_id", E1.id), "before");
  must(await ad.from("profiles").update({ curriculum_id: cid.cambridge }).eq("id", E1.id), "admin moves E1");
  check("after an admin change, the student no longer sees the old curriculum", !(await seesUnit(E1, E.unit)) && !(await seesUnit(E1, E.unit)));
  check("…and sees the new one", await seesUnit(E1, C.unit));
  const leftover = must(await service.from("content_grants").select("id").eq("student_id", E1.id), "grants");
  check("…their individual access on old-curriculum content is removed", leftover.length === 0);
  const progressAfter = must(await service.from("node_completions").select("node_id").eq("student_id", E1.id), "after");
  check("…their earlier progress records are kept", progressBefore.length === 1 && progressAfter.length === 1);
  const audit = must(await service.from("progress_audit").select("action, details, admin_id").eq("student_id", E1.id), "audit");
  check(
    "…and the change is recorded",
    audit.some((a) => a.action === "curriculum_change" && a.details.from === "Edexcel" && a.details.to === "Cambridge" && a.admin_id === admin.id),
  );

  console.log("Existing content");
  const edx = must(await service.from("courses").select("id, curriculum_id, units(slug)").eq("slug", "edexcel-ias-physics").single(), "edexcel");
  check(
    "the original Edexcel course and its units are kept and linked to Edexcel",
    edx.curriculum_id === cid.edexcel && ["unit-1", "unit-2", "unit-3", "unit-4", "unit-5", "unit-6"].every((s) => edx.units.some((u) => u.slug === s)),
  );
}

async function cleanup() {
  for (const id of createdUnits) await service.from("units").delete().eq("id", id);
  for (const id of createdUsers) await service.auth.admin.deleteUser(id);
}

try {
  await main();
} catch (err) {
  failed++;
  console.error(`\n✖ Test aborted: ${err.message}`);
} finally {
  await cleanup();
  console.log(`\n${passed} passed, ${failed} failed. Temporary users and content removed.\n`);
  process.exit(failed ? 1 : 0);
}
