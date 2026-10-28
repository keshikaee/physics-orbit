#!/usr/bin/env node
/**
 * Integration test for interaction tracking (activity_events / log_activity).
 *
 *   npm run test:activity
 *
 * Checks that only the database function can write events, that it records
 * only active students and only content they can see, that repeats are
 * ignored, and that only admins can read the log.
 *
 * Runs against the Supabase project in .env.local with temporary,
 * pre-confirmed users and a temporary unit, and deletes everything it
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
const password = `Act-${randomUUID()}`;
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

async function makeUser(label, curriculum, role) {
  const email = `act-${label}-${run}@example.com`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `ACT ${label} ${run}`, ...(curriculum ? { curriculum, privacy_consent: "true" } : {}) },
  });
  if (error) throw new Error(`createUser(${label}): ${error.message}`);
  createdUsers.push(data.user.id);
  if (role) must(await service.from("profiles").update({ role }).eq("id", data.user.id), "role");
  const db = createClient(url, anonKey, noSession);
  must(await db.auth.signInWithPassword({ email, password }), `signIn(${label})`);
  return { id: data.user.id, db };
}

const eventsOf = async (studentId) =>
  must(await service.from("activity_events").select("*").eq("student_id", studentId).order("created_at"), "read events");

async function main() {
  const admin = await makeUser("admin", null, "admin");
  const ad = admin.db;
  const S = await makeUser("s1", "edexcel");
  const S2 = await makeUser("s2", "edexcel");
  const C = await makeUser("cam", "cambridge");

  // Temporary content in the Edexcel course: a visible unit/topic/material, plus a hidden material.
  const course = must(await service.from("courses").select("id").eq("slug", "edexcel-ias-physics").single(), "course");
  const unit = must(
    await ad
      .from("units")
      .insert({ course_id: course.id, slug: `act-${run}`, code: "ACT", title: `Activity unit ${run}`, order_index: 991, is_published: true, needs_review: false })
      .select("id")
      .single(),
    "unit",
  );
  createdUnits.push(unit.id);
  const topic = must(await ad.from("topics").insert({ unit_id: unit.id, slug: "t", title: "Activity topic", is_published: true }).select("id").single(), "topic");
  const visible = must(
    await ad.from("materials").insert({ topic_id: topic.id, kind: "link", title: "Visible link", url: "https://example.com", is_published: true }).select("id").single(),
    "material",
  );
  const hidden = must(
    await ad.from("materials").insert({ topic_id: topic.id, kind: "link", title: "Draft link", url: "https://example.com", is_published: false }).select("id").single(),
    "material",
  );

  console.log("\nRecording");
  check("student can log a sign-in", !(await S.db.rpc("log_activity", { p_kind: "sign_in" })).error);
  await S.db.rpc("log_activity", { p_kind: "sign_in" });
  let rows = await eventsOf(S.id);
  check("a repeated sign-in within a minute is recorded once", rows.filter((r) => r.kind === "sign_in").length === 1, `${rows.length} rows`);

  must(await S.db.rpc("log_activity", { p_kind: "material_view", p_target: visible.id }), "log material");
  must(await S.db.rpc("log_activity", { p_kind: "material_view", p_target: visible.id }), "log material again");
  rows = (await eventsOf(S.id)).filter((r) => r.kind === "material_view");
  check("a visible material view is recorded once (repeat ignored)", rows.length === 1, `${rows.length} rows`);
  check(
    "the server fills in unit, subtopic and title",
    rows[0]?.unit_id === unit.id && rows[0]?.topic_id === topic.id && rows[0]?.material_id === visible.id && rows[0]?.title === "Visible link",
  );

  must(await S.db.rpc("log_activity", { p_kind: "topic_view", p_target: topic.id }), "log topic");
  must(await S.db.rpc("log_activity", { p_kind: "unit_view", p_target: unit.id }), "log unit");
  rows = await eventsOf(S.id);
  check("subtopic and unit views are recorded", rows.some((r) => r.kind === "topic_view") && rows.some((r) => r.kind === "unit_view"));
  check("unit view title includes the unit code", rows.find((r) => r.kind === "unit_view")?.title === `ACT: Activity unit ${run}`);

  console.log("\nRejected silently");
  const before = (await eventsOf(S.id)).length;
  await S.db.rpc("log_activity", { p_kind: "material_view", p_target: hidden.id });
  await S.db.rpc("log_activity", { p_kind: "material_view", p_target: randomUUID() });
  await S.db.rpc("log_activity", { p_kind: "unit_view", p_target: null });
  check("unpublished, missing or untargeted views are not recorded", (await eventsOf(S.id)).length === before);

  await C.db.rpc("log_activity", { p_kind: "material_view", p_target: visible.id });
  check("a student can't log content from another curriculum", (await eventsOf(C.id)).length === 0);

  await ad.rpc("log_activity", { p_kind: "sign_in" });
  check("admin activity is not tracked", (await eventsOf(admin.id)).length === 0);

  const anon = createClient(url, anonKey, noSession);
  const anonCall = await anon.rpc("log_activity", { p_kind: "sign_in" });
  check("signed-out callers can't call log_activity", !!anonCall.error);

  must(await service.from("profiles").update({ status: "suspended" }).eq("id", S2.id), "suspend");
  await S2.db.rpc("log_activity", { p_kind: "sign_in" });
  check("deactivated students are not tracked", (await eventsOf(S2.id)).length === 0);

  console.log("\nAccess to the log");
  check("students can't read activity (even their own)", (await S.db.from("activity_events").select("id")).data?.length === 0);
  const forged = await S.db.from("activity_events").insert({ student_id: S.id, kind: "sign_in" });
  check("students can't insert events directly", !!forged.error);
  const forgedOther = await S.db.from("activity_events").insert({ student_id: C.id, kind: "material_view", title: "fake" });
  check("students can't forge events for others", !!forgedOther.error && (await eventsOf(C.id)).length === 0);
  const count = (await eventsOf(S.id)).length;
  await S.db.from("activity_events").delete().eq("student_id", S.id);
  await S.db.from("activity_events").update({ title: "edited" }).eq("student_id", S.id);
  const after = await eventsOf(S.id);
  check("students can't delete or edit events", after.length === count && after.every((r) => r.title !== "edited"));
  const adminRead = must(await ad.from("activity_events").select("id, kind").eq("student_id", S.id), "admin read");
  check("admins can read a student's activity", adminRead.length === count && count >= 4, `${adminRead.length}/${count}`);
  check("anonymous users can't read activity", ((await anon.from("activity_events").select("id")).data ?? []).length === 0);

  console.log("\nContent deletion");
  must(await ad.from("materials").delete().eq("id", visible.id), "delete material");
  const kept = (await eventsOf(S.id)).find((r) => r.kind === "material_view");
  check("history survives deleted content (id cleared, title kept)", kept?.material_id === null && kept?.title === "Visible link");
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
