#!/usr/bin/env node
/**
 * Integration test for roadmaps, quizzes and per-student progress (RLS,
 * server-side marking, completion rules, audit).
 *
 *   npm run test:roadmap
 *
 * Runs against the Supabase project in .env.local with temporary,
 * pre-confirmed users and a temporary unit, and deletes everything it
 * created afterwards — even on failure. Existing users and content are
 * never touched.
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
const password = `Rm-${randomUUID()}`;
const createdUsers = [];
const createdUnits = [];
const createdFiles = [];

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

async function makeUser(label, role = "student") {
  const email = `rm-${label}-${run}@example.com`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `RM ${label} ${run}`, curriculum: "edexcel" },
  });
  if (error) throw new Error(`createUser(${label}): ${error.message}`);
  createdUsers.push(data.user.id);
  if (role !== "student") must(await service.from("profiles").update({ role }).eq("id", data.user.id), "set role");
  const client = createClient(url, anonKey, noSession);
  must(await client.auth.signInWithPassword({ email, password }), `signIn(${label})`);
  return { id: data.user.id, db: client };
}

const ids = (rows) => (rows ?? []).map((r) => r.id).sort();
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

function node(id, title, extra = {}) {
  return {
    id,
    kind: "lesson",
    title,
    description: `About ${title}`,
    x: 0,
    y: 0,
    topicId: null,
    isRequired: true,
    completionRule: "all_required",
    minQuizzes: null,
    lockUntilPrereqs: false,
    materialIds: [],
    accessMode: "all",
    studentIds: [],
    ...extra,
  };
}

async function main() {
  console.log(`\nRoadmap & progress integration test (run ${run})\n`);
  const admin = await makeUser("admin", "admin");
  const A = await makeUser("a");
  const B = await makeUser("b");
  const C = await makeUser("c");
  const ad = admin.db;

  // ── Content: unit (all) → T1 (all) + T2 "Newton's Laws" (A only) ──
  const course = must(await service.from("courses").select("id").eq("slug", "edexcel-ias-physics").single(), "course");
  const unit = must(
    await ad
      .from("units")
      .insert({ course_id: course.id, slug: `rm-unit-${run}`, code: "RM", title: "RM Unit", order_index: 998, is_published: true, needs_review: false })
      .select("id")
      .single(),
    "unit"
  );
  createdUnits.push(unit.id);
  const T1 = must(await ad.from("topics").insert({ unit_id: unit.id, slug: "kinematics", title: "Kinematics", is_published: true }).select("id").single(), "T1");
  const T2 = must(await ad.from("topics").insert({ unit_id: unit.id, slug: "newton", title: "Newton's Laws", is_published: true }).select("id").single(), "T2");
  must(await ad.rpc("set_content_access", { p_kind: "topic", p_id: T2.id, p_mode: "selected", p_students: [A.id] }), "T2 access");
  const M1 = must(
    await ad.from("materials").insert({ topic_id: T1.id, kind: "link", title: "Sim", url: "https://phet.colorado.edu", is_published: true }).select("id").single(),
    "M1"
  );

  // ── Roadmap ──
  console.log("Structure & visibility");
  const roadmap = must(await ad.from("roadmaps").insert({ unit_id: unit.id }).select("id, version").single(), "roadmap");
  const N = Object.fromEntries(["n1", "n2", "n3", "n4", "n5"].map((k) => [k, randomUUID()]));
  const nodes = [
    node(N.n1, "Physical Quantities", { completionRule: "student_mark", topicId: T1.id, materialIds: [M1.id] }),
    node(N.n2, "Kinematics quiz", { kind: "quiz", topicId: T1.id, lockUntilPrereqs: true, x: 300 }),
    node(N.n3, "Newton's Laws", { topicId: T2.id, x: 600 }),
    node(N.n4, "Milestone", { kind: "milestone", completionRule: "admin_confirm", y: 200 }),
    node(N.n5, "Extension (B only)", { accessMode: "selected", studentIds: [B.id], y: 400 }),
  ];
  const edges = [
    { source: N.n1, target: N.n2 },
    { source: N.n2, target: N.n3 },
    { source: N.n1, target: N.n4 },
  ];
  let version = must(await ad.rpc("save_roadmap", { p_roadmap: roadmap.id, p_version: roadmap.version, p_nodes: nodes, p_edges: edges }), "save_roadmap");
  check("admin saves a roadmap (version bumps)", version === roadmap.version + 1);

  const seenNodes = async (u) => ids((await u.db.from("roadmap_nodes").select("id").eq("roadmap_id", roadmap.id)).data);
  check("students cannot see an unpublished roadmap", (await seenNodes(A)).length === 0 && (await A.db.from("roadmaps").select("id").eq("id", roadmap.id)).data.length === 0);

  must(await ad.from("roadmaps").update({ is_published: true }).eq("id", roadmap.id), "publish");
  check("A sees steps 1–4 (has Newton's Laws, not B's extension)", same(await seenNodes(A), [N.n1, N.n2, N.n3, N.n4]));
  check("B sees steps 1, 2, 4 and the extension, not Newton's Laws", same(await seenNodes(B), [N.n1, N.n2, N.n4, N.n5]));
  check("C sees steps 1, 2 and 4 only", same(await seenNodes(C), [N.n1, N.n2, N.n4]));
  const bEdges = must(await B.db.from("roadmap_edges").select("source_id, target_id").eq("roadmap_id", roadmap.id), "B edges");
  check("B does not see the connection into Newton's Laws", bEdges.length === 2 && !bEdges.some((e) => e.target_id === N.n3));
  const bLinks = must(await B.db.from("roadmap_node_materials").select("material_id").eq("node_id", N.n1), "links");
  check("students see a step's linked materials they can access", bLinks.length === 1);

  check("locked steps are hidden by default", (await B.db.rpc("roadmap_locked_steps", { p_roadmap: roadmap.id })).data.length === 0);
  must(await ad.from("roadmaps").update({ restricted_display: "lock" }).eq("id", roadmap.id), "lock display");
  const locked = must(await B.db.rpc("roadmap_locked_steps", { p_roadmap: roadmap.id }), "locked steps");
  check(
    "'visible but locked' reveals only title/type/position of the restricted step",
    locked.length === 1 && locked[0].id === N.n3 && Object.keys(locked[0]).sort().join() === "id,kind,pos_x,pos_y,title"
  );
  const bDirect = must(await B.db.from("roadmap_nodes").select("description").eq("id", N.n3), "direct");
  check("…and the restricted step's details stay unreadable", bDirect.length === 0);
  must(await ad.from("roadmaps").update({ restricted_display: "hide" }).eq("id", roadmap.id), "hide display");

  // ── Students cannot change structure or progress ──
  console.log("Write protection");
  await A.db.from("roadmap_nodes").update({ title: "hacked" }).eq("id", N.n1);
  const t = must(await service.from("roadmap_nodes").select("title").eq("id", N.n1).single(), "title");
  check("students cannot edit roadmap steps", t.title === "Physical Quantities");
  const ins = await A.db.from("roadmap_edges").insert({ roadmap_id: roadmap.id, source_id: N.n4, target_id: N.n2 });
  check("students cannot add connections", Boolean(ins.error));
  const fake = await A.db.from("node_completions").insert({ student_id: A.id, node_id: N.n2, source: "auto" });
  check("students cannot write completions directly", Boolean(fake.error));
  const fakeAttempt = await A.db.from("quiz_attempts").insert({ quiz_id: randomUUID(), student_id: A.id, attempt_no: 1, status: "marked", score: 10, max_score: 10, passed: true });
  check("students cannot write quiz attempts/scores directly", Boolean(fakeAttempt.error));
  const sv = await A.db.rpc("save_roadmap", { p_roadmap: roadmap.id, p_version: version, p_nodes: [], p_edges: [] });
  check("students cannot call save_roadmap", Boolean(sv.error) && (await seenNodes(A)).length === 4);

  // ── Quiz ──
  console.log("Quizzes & marking");
  const Q = { id: randomUUID(), q1: randomUUID(), q2: randomUUID(), q3: randomUUID(), q4: randomUUID() };
  const c = Object.fromEntries(["a", "b", "c", "d", "e", "f", "g"].map((k) => [k, randomUUID()]));
  const quiz = {
    id: Q.id,
    nodeId: N.n2,
    title: "Kinematics check",
    description: "",
    passPercent: 60,
    maxAttempts: 2,
    reveal: "after_submit",
    requirePass: true,
    isRequired: true,
    isPublished: false,
    questions: [
      { id: Q.q1, kind: "mcq_single", prompt: "SI unit of force?", marks: 1, choices: [{ id: c.a, label: "N" }, { id: c.b, label: "J" }], key: { correctChoiceIds: [c.a] } },
      {
        id: Q.q2,
        kind: "mcq_multi",
        prompt: "Which are vectors?",
        marks: 2,
        choices: [{ id: c.c, label: "velocity" }, { id: c.d, label: "speed" }, { id: c.e, label: "force" }],
        key: { correctChoiceIds: [c.c, c.e], explanation: "Vectors have direction." },
      },
      {
        id: Q.q3,
        kind: "numeric",
        prompt: "Speed of light $c$?",
        marks: 1,
        key: { numericAnswer: 3.0e8, tolerance: 1, toleranceKind: "percent", units: ["m/s", "m s^-1"] },
      },
      { id: Q.q4, kind: "short", prompt: "State Newton's first law.", marks: 2, key: { modelAnswer: "An object stays at rest or moves at constant velocity unless a resultant force acts." } },
    ],
  };
  must(await ad.rpc("save_quiz", { p_quiz: quiz }), "save_quiz");
  check("students cannot see an unpublished quiz", (await A.db.from("quizzes").select("id").eq("id", Q.id)).data.length === 0);
  quiz.isPublished = true;
  must(await ad.rpc("save_quiz", { p_quiz: quiz }), "publish quiz");
  check("A can read the published quiz's questions", (await A.db.from("questions").select("id").eq("quiz_id", Q.id)).data.length === 4);
  check("A can read answer choices", (await A.db.from("question_choices").select("id").in("question_id", [Q.q1, Q.q2])).data.length === 5);
  check("A can NOT read answer keys", (await A.db.from("question_keys").select("question_id").in("question_id", [Q.q1, Q.q2, Q.q3, Q.q4])).data.length === 0);
  const bad = await ad.rpc("save_quiz", { p_quiz: { ...quiz, id: randomUUID(), questions: [{ ...quiz.questions[0], id: randomUUID(), choices: [{ id: randomUUID(), label: "x" }, { id: randomUUID(), label: "y" }], key: { correctChoiceIds: [c.a] } }] } });
  check("a correct answer must be one of the question's own choices", Boolean(bad.error));

  const allRight = {
    [Q.q1]: { choices: [c.a] },
    [Q.q2]: { choices: [c.e, c.c] },
    [Q.q3]: { value: 3.02e8, unit: "ms^-1", raw: "3.02e8" },
    [Q.q4]: { text: "Objects keep their velocity unless a resultant force acts." },
  };
  const locked1 = await A.db.rpc("submit_quiz", { p_quiz: Q.id, p_answers: allRight });
  check("a prerequisite-locked quiz cannot be submitted", Boolean(locked1.error) && /earlier steps/.test(locked1.error.message));
  const wrongRule = await A.db.rpc("set_own_node_done", { p_node: N.n2, p_done: true });
  check("students cannot self-complete a quiz-based step", Boolean(wrongRule.error));
  must(await A.db.rpc("set_own_node_done", { p_node: N.n1, p_done: true }), "A marks step 1 done");

  const aAttempt = must(await A.db.rpc("submit_quiz", { p_quiz: Q.id, p_answers: allRight }), "A submit");
  let at = must(await service.from("quiz_attempts").select("*").eq("id", aAttempt).single(), "attempt");
  check("auto-marked parts scored on the server (4/6, short answer pending)", Number(at.score) === 4 && Number(at.max_score) === 6 && at.status === "awaiting_marking" && at.passed === null);
  let aDone = must(await A.db.from("node_completions").select("node_id"), "A completions").map((r) => r.node_id);
  check("a step awaiting marking is not yet complete", same(aDone, [N.n1]));

  const review = must(await A.db.rpc("attempt_review", { p_attempt: aAttempt }), "review");
  check("A can review the attempt with answers revealed (after submit)", review.revealed === true && review.responses.find((r) => r.question_id === Q.q2).key.explanation === "Vectors have direction.");
  check("B cannot review A's attempt", (await B.db.rpc("attempt_review", { p_attempt: aAttempt })).data === null);
  check("B cannot read A's attempts", (await B.db.from("quiz_attempts").select("id").eq("id", aAttempt)).data.length === 0);

  const shortResp = must(await service.from("attempt_responses").select("id").eq("attempt_id", aAttempt).eq("question_kind", "short").single(), "resp");
  const studentMark = await A.db.rpc("mark_response", { p_response: shortResp.id, p_marks: 2, p_feedback: "" });
  check("students cannot mark answers", Boolean(studentMark.error));
  const tooMany = await ad.rpc("mark_response", { p_response: shortResp.id, p_marks: 5, p_feedback: "" });
  check("marks above the question's maximum are refused", Boolean(tooMany.error));
  must(await ad.rpc("mark_response", { p_response: shortResp.id, p_marks: 2, p_feedback: "Good" }), "admin marks");
  at = must(await service.from("quiz_attempts").select("*").eq("id", aAttempt).single(), "attempt");
  check("after manual marking the attempt is 6/6 and passed", Number(at.score) === 6 && at.status === "marked" && at.passed === true);
  aDone = must(await A.db.from("node_completions").select("node_id"), "A completions").map((r) => r.node_id);
  check("passing the required quiz completes the step for A", same(aDone, [N.n1, N.n2]));

  must(await ad.rpc("mark_response", { p_response: shortResp.id, p_marks: 1, p_feedback: "Re-marked" }), "re-mark");
  const remark = must(await service.from("progress_audit").select("action, details").eq("student_id", A.id).eq("action", "remark"), "audit");
  check("re-marking is recorded in the audit log", remark.length === 1 && Number(remark[0].details.from) === 2 && Number(remark[0].details.to) === 1);

  // B: no prerequisite done yet → mark step 1, then a failing attempt.
  must(await B.db.rpc("set_own_node_done", { p_node: N.n1, p_done: true }), "B step 1");
  const bWrong = must(
    await B.db.rpc("submit_quiz", {
      p_quiz: Q.id,
      p_answers: {
        [Q.q1]: { choices: [c.a, c.b] }, // two picks on single-answer → wrong
        [Q.q2]: { choices: [c.c] }, // incomplete → wrong
        [Q.q3]: { value: 3.0e8, unit: "km/s", raw: "3e8" }, // wrong unit
        [Q.q4]: { text: "" },
        [randomUUID()]: { choices: [c.a] }, // unknown question ignored
      },
    }),
    "B submit"
  );
  const bAt = must(await service.from("quiz_attempts").select("score, status").eq("id", bWrong).single(), "B attempt");
  check("wrong answers (2 picks on single-answer, partial multi, wrong unit) score 0", Number(bAt.score) === 0 && bAt.status === "awaiting_marking");
  const bDone = must(await B.db.from("node_completions").select("node_id"), "B completions").map((r) => r.node_id);
  check("A's completion does not affect B", same(bDone, [N.n1]));

  must(await B.db.rpc("submit_quiz", { p_quiz: Q.id, p_answers: allRight }), "B second");
  const third = await B.db.rpc("submit_quiz", { p_quiz: Q.id, p_answers: allRight });
  check("the attempt limit is enforced (3rd of 2 refused)", Boolean(third.error) && /no attempts left/.test(third.error.message));

  must(await ad.from("quizzes").update({ is_published: false }).eq("id", Q.id), "unpublish quiz");
  const hiddenReview = must(await B.db.rpc("attempt_review", { p_attempt: bWrong }), "review after unpublish");
  check("after a quiz is unpublished, past results stay but answers are hidden", hiddenReview.revealed === false && hiddenReview.responses.every((r) => r.key === null));
  must(await ad.from("quizzes").update({ is_published: true }).eq("id", Q.id), "republish quiz");

  // C: parallel submissions can't exceed the limit or duplicate attempt numbers.
  must(await C.db.rpc("set_own_node_done", { p_node: N.n1, p_done: true }), "C step 1");
  const burst = await Promise.all([1, 2, 3, 4].map(() => C.db.rpc("submit_quiz", { p_quiz: Q.id, p_answers: allRight })));
  const cRows = must(await service.from("quiz_attempts").select("attempt_no").eq("quiz_id", Q.id).eq("student_id", C.id), "C attempts");
  check(
    "4 simultaneous submits → exactly 2 attempts, numbered 1 and 2",
    burst.filter((r) => !r.error).length === 2 && same(cRows.map((r) => String(r.attempt_no)), ["1", "2"])
  );

  // Restricted content stays restricted through quizzes.
  const QN3 = randomUUID();
  must(
    await ad.rpc("save_quiz", {
      p_quiz: { ...quiz, id: QN3, nodeId: N.n3, title: "Newton quiz", questions: [{ ...quiz.questions[0], id: randomUUID(), choices: [{ id: randomUUID(), label: "N" }, { id: randomUUID(), label: "J" }], key: { correctChoiceIds: [] } }] },
    }).then((r) => (r.error && /exactly one/.test(r.error.message) ? { data: true } : r)),
    "validation"
  );
  const n3q = { ...quiz, id: QN3, nodeId: N.n3, title: "Newton quiz", questions: [{ id: randomUUID(), kind: "short", prompt: "Secret?", marks: 1, key: { autoExact: true, acceptedAnswers: ["Inertia"] } }] };
  must(await ad.rpc("save_quiz", { p_quiz: n3q }), "N3 quiz");
  check("B cannot see questions of a restricted step", (await B.db.from("questions").select("id").eq("quiz_id", QN3)).data.length === 0);
  // Question images: private storage, readable only by students who can open the quiz.
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  const imgPath = `quiz/${QN3}/${randomUUID()}.png`;
  const up = await ad.storage.from("materials").upload(imgPath, png, { contentType: "image/png" });
  if (up.error) throw new Error(`image upload: ${up.error.message}`);
  createdFiles.push(imgPath);
  must(await ad.rpc("save_quiz", { p_quiz: { ...n3q, questions: [{ ...n3q.questions[0], imagePath: imgPath }] } }), "attach image");
  const aImg = await A.db.storage.from("materials").createSignedUrl(imgPath, 60);
  const bImg = await B.db.storage.from("materials").createSignedUrl(imgPath, 60);
  check("a student who can open the quiz can view its question image", Boolean(aImg.data?.signedUrl));
  check("a student without access cannot get the question image", !bImg.data?.signedUrl);
  const studentUpload = await A.db.storage.from("materials").upload(`quiz/${QN3}/${randomUUID()}.png`, png, { contentType: "image/png" });
  check("students cannot upload question images", Boolean(studentUpload.error));

  const bN3 = await B.db.rpc("submit_quiz", { p_quiz: QN3, p_answers: {} });
  check("B cannot submit a quiz on a restricted step", Boolean(bN3.error) && /not available/.test(bN3.error.message));
  // A: N3 is locked? No — locking is off for N3. Exact-match short answer is auto-marked (case-insensitive).
  const aN3 = must(await A.db.rpc("submit_quiz", { p_quiz: QN3, p_answers: { [n3q.questions[0].id]: { text: "  inertia " } } }), "A N3");
  const aN3At = must(await service.from("quiz_attempts").select("passed, status").eq("id", aN3).single(), "A N3 attempt");
  check("exact-match short answers are auto-marked when switched on", aN3At.passed === true && aN3At.status === "marked");

  const neverQuiz = { ...n3q, id: randomUUID(), nodeId: N.n2, title: "Hidden answers", reveal: "never", questions: [{ ...n3q.questions[0], id: randomUUID() }] };
  must(await ad.rpc("save_quiz", { p_quiz: neverQuiz }), "never quiz");
  const nAt = must(await A.db.rpc("submit_quiz", { p_quiz: neverQuiz.id, p_answers: {} }), "never submit");
  const nReview = must(await A.db.rpc("attempt_review", { p_attempt: nAt }), "never review");
  check("'never show answers' keeps the key hidden in the review", nReview.revealed === false && nReview.responses.every((r) => r.key === null));

  // ── Editing a published roadmap keeps progress ──
  console.log("Editing after progress");
  const stale = await ad.rpc("save_roadmap", { p_roadmap: roadmap.id, p_version: version - 1, p_nodes: nodes, p_edges: edges });
  check("saving over a newer version is refused (no silent overwrite)", Boolean(stale.error) && /conflict/.test(stale.error.message));
  const N6 = randomUUID();
  const edited = [
    { ...nodes[0], x: 50 },
    { ...nodes[1], title: "Kinematics quiz (renamed)", x: 400, y: 80 },
    nodes[2],
    nodes[4],
    node(N6, "New step", { y: 600 }),
  ];
  version = must(
    await ad.rpc("save_roadmap", { p_roadmap: roadmap.id, p_version: version, p_nodes: edited, p_edges: [{ source: N.n1, target: N.n2 }, { source: N.n2, target: N6 }] }),
    "edit"
  );
  aDone = must(await A.db.from("node_completions").select("node_id"), "A completions").map((r) => r.node_id);
  check("renaming/moving steps keeps A's completions", aDone.includes(N.n1) && aDone.includes(N.n2));
  check("A's quiz attempts survive the edit", (await A.db.from("quiz_attempts").select("id").eq("quiz_id", Q.id)).data.length === 1);
  check("the removed step is gone; the new one appears", same(await seenNodes(A), [N.n1, N.n2, N.n3, N6]));

  must(await ad.from("topics").delete().eq("id", T2.id), "delete T2");
  const n3 = must(await service.from("roadmap_nodes").select("topic_id").eq("id", N.n3).single(), "n3");
  check("deleting a linked subtopic keeps the step and clears the link", n3.topic_id === null);

  // ── Admin overrides are audited ──
  console.log("Overrides & audit");
  const noReason = await ad.rpc("admin_set_completion", { p_student: B.id, p_node: N.n2, p_completed: true, p_reason: " " });
  check("overrides require a reason", Boolean(noReason.error));
  must(await ad.rpc("admin_set_completion", { p_student: B.id, p_node: N.n2, p_completed: true, p_reason: "Completed on paper" }), "override");
  const bNow = must(await B.db.from("node_completions").select("node_id, source"), "B now");
  check("admin can mark a step complete for one student", bNow.some((r) => r.node_id === N.n2 && r.source === "admin"));
  const selfOverride = await B.db.rpc("admin_set_completion", { p_student: B.id, p_node: N6, p_completed: true, p_reason: "x" });
  check("students cannot call admin overrides", Boolean(selfOverride.error));
  must(await ad.rpc("admin_reset_node", { p_student: A.id, p_node: N.n2, p_reason: "Retake after absence" }), "reset");
  const aAfter = must(await A.db.from("node_completions").select("node_id"), "A after").map((r) => r.node_id);
  const aAttemptsAfter = must(await A.db.from("quiz_attempts").select("id, quiz_id"), "A attempts after").filter((r) => r.quiz_id === Q.id || r.quiz_id === neverQuiz.id);
  check("reset clears that step's attempts and completion for A only", !aAfter.includes(N.n2) && aAttemptsAfter.length === 0);
  const audit = must(await service.from("progress_audit").select("action, reason").in("student_id", [A.id, B.id]), "audit");
  check("overrides and resets are audited with reasons", audit.some((r) => r.action === "mark_complete" && r.reason === "Completed on paper") && audit.some((r) => r.action === "reset_step"));
  check("students cannot read the audit log", (await A.db.from("progress_audit").select("id")).data.length === 0);
}

async function cleanup() {
  if (createdFiles.length) await service.storage.from("materials").remove(createdFiles);
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
