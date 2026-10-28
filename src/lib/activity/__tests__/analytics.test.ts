import { describe, expect, it } from "vitest";
import {
  averageScore,
  buildTimeline,
  byStudent,
  dailySeries,
  dayKey,
  kindBreakdown,
  lastDays,
  parsePeriod,
  percentOf,
  periodStart,
  studentStats,
  topMaterials,
  type ActivityEvent,
  type AttemptRow,
  type CompletionRow,
} from "../analytics";
import { attemptResult, timeAgo } from "../format";

const ev = (student_id: string, kind: ActivityEvent["kind"], created_at: string, extra: Partial<ActivityEvent> = {}): ActivityEvent => ({
  student_id,
  kind,
  unit_id: null,
  topic_id: null,
  material_id: null,
  quiz_id: null,
  title: "",
  created_at,
  ...extra,
});
const att = (student_id: string, submitted_at: string, extra: Partial<AttemptRow> = {}): AttemptRow => ({
  id: `a-${submitted_at}`,
  student_id,
  quiz_id: "q1",
  attempt_no: 1,
  status: "marked",
  score: 5,
  max_score: 10,
  passed: false,
  submitted_at,
  quiz_title: "Quiz",
  ...extra,
});
const done = (student_id: string, completed_at: string): CompletionRow => ({
  student_id,
  node_id: `n-${completed_at}`,
  source: "auto",
  completed_at,
  node_title: "Step",
});

describe("time buckets (Asia/Colombo, UTC+05:30)", () => {
  it("assigns instants to the local day", () => {
    expect(dayKey("2026-10-27T18:29:00Z")).toBe("2026-10-27"); // 23:59 local
    expect(dayKey("2026-10-27T18:31:00Z")).toBe("2026-10-28"); // 00:01 local
  });

  it("lists the last N days, oldest first, ending today", () => {
    const now = new Date("2026-10-28T05:00:00Z");
    expect(lastDays(3, now)).toEqual(["2026-10-26", "2026-10-27", "2026-10-28"]);
    expect(lastDays(30, now)).toHaveLength(30);
    // Month boundaries
    expect(lastDays(2, new Date("2026-03-01T06:00:00Z"))).toEqual(["2026-02-28", "2026-03-01"]);
  });

  it("starts a period at local midnight of its first day", () => {
    expect(periodStart(7, new Date("2026-10-28T05:00:00Z")).toISOString()).toBe("2026-10-21T18:30:00.000Z");
  });

  it("accepts only supported periods", () => {
    expect(parsePeriod("7")).toBe(7);
    expect(parsePeriod("90")).toBe(90);
    expect(parsePeriod("365")).toBe(30);
    expect(parsePeriod(undefined)).toBe(30);
  });
});

describe("dailySeries", () => {
  const now = new Date("2026-10-28T06:00:00Z");
  it("counts interactions and distinct students per day from all three sources", () => {
    const series = dailySeries(
      [ev("s1", "sign_in", "2026-10-28T01:00:00Z"), ev("s1", "material_view", "2026-10-28T02:00:00Z"), ev("s2", "sign_in", "2026-10-27T04:00:00Z")],
      [att("s2", "2026-10-28T03:00:00Z")],
      [done("s3", "2026-10-26T03:00:00Z")],
      3,
      now,
    );
    expect(series).toEqual([
      { day: "2026-10-26", interactions: 1, students: 1 },
      { day: "2026-10-27", interactions: 1, students: 1 },
      { day: "2026-10-28", interactions: 3, students: 2 },
    ]);
  });

  it("ignores rows outside the window and returns zero days", () => {
    const series = dailySeries([ev("s1", "sign_in", "2026-09-01T00:00:00Z")], [], [], 2, now);
    expect(series.every((p) => p.interactions === 0 && p.students === 0)).toBe(true);
  });
});

describe("studentStats", () => {
  it("summarises one student's activity", () => {
    const s = studentStats(
      [
        ev("s1", "sign_in", "2026-10-20T03:00:00Z"),
        ev("s1", "material_view", "2026-10-20T04:00:00Z", { material_id: "m1" }),
        ev("s1", "material_view", "2026-10-21T04:00:00Z", { material_id: "m1" }),
        ev("s1", "material_view", "2026-10-21T05:00:00Z", { material_id: "m2" }),
      ],
      [
        att("s1", "2026-10-22T03:00:00Z", { score: 8, max_score: 10, passed: true }),
        att("s1", "2026-10-22T04:00:00Z", { score: 4, max_score: 10 }),
        att("s1", "2026-10-23T04:00:00Z", { status: "awaiting_marking", passed: null, score: 0 }),
      ],
      [done("s1", "2026-10-24T03:00:00Z")],
    );
    expect(s).toEqual({
      lastActive: "2026-10-24T03:00:00Z",
      activeDays: 5,
      interactions: 8,
      signIns: 1,
      materialsOpened: 2,
      materialViews: 3,
      quizAttempts: 3,
      quizzesPassed: 1,
      averageScore: 60, // (80 + 40) / 2 — attempt awaiting marking excluded
      awaitingMarking: 1,
      stepsCompleted: 1,
    });
  });

  it("is empty-safe", () => {
    const s = studentStats([], [], []);
    expect(s.lastActive).toBeNull();
    expect(s.averageScore).toBeNull();
    expect(s.interactions).toBe(0);
  });

  it("skips zero-mark attempts in the average", () => {
    expect(studentStats([], [att("s1", "2026-10-22T03:00:00Z", { max_score: 0, score: 0 })], []).averageScore).toBeNull();
  });
});

describe("aggregates", () => {
  it("pools scores over marked attempts", () => {
    expect(averageScore([att("a", "1", { score: 10, max_score: 10 }), att("b", "2", { score: 1, max_score: 4 })])).toBe(62.5);
    expect(averageScore([att("a", "1", { status: "awaiting_marking" })])).toBeNull();
  });

  it("ranks materials by distinct students, then opens, using the latest title", () => {
    const top = topMaterials([
      ev("s1", "material_view", "2026-10-20T00:00:00Z", { material_id: "m1", title: "Old name" }),
      ev("s1", "material_view", "2026-10-21T00:00:00Z", { material_id: "m1", title: "New name" }),
      ev("s1", "material_view", "2026-10-21T00:00:00Z", { material_id: "m1", title: "New name" }),
      ev("s1", "material_view", "2026-10-21T00:00:00Z", { material_id: "m2", title: "B" }),
      ev("s2", "material_view", "2026-10-21T00:00:00Z", { material_id: "m2", title: "B" }),
      ev("s2", "topic_view", "2026-10-21T00:00:00Z", { topic_id: "t1", title: "Topic" }),
      ev("s3", "material_view", "2026-10-21T00:00:00Z", { material_id: null, title: "Deleted" }),
    ]);
    expect(top).toEqual([
      { id: "m2", title: "B", views: 2, students: 2 },
      { id: "m1", title: "New name", views: 3, students: 1 },
    ]);
  });

  it("counts by type including submissions and completions", () => {
    const k = kindBreakdown([ev("s", "sign_in", "x"), ev("s", "sign_in", "y"), ev("s", "quiz_view", "z")], 4, 2);
    expect(k.sign_in).toBe(2);
    expect(k.quiz_view).toBe(1);
    expect(k.material_view).toBe(0);
    expect(k.quiz_submit).toBe(4);
    expect(k.step_complete).toBe(2);
  });

  it("groups rows by student", () => {
    const m = byStudent([ev("a", "sign_in", "1"), ev("b", "sign_in", "2"), ev("a", "sign_in", "3")]);
    expect(m.get("a")).toHaveLength(2);
    expect(m.get("b")).toHaveLength(1);
  });

  it("computes percentages safely", () => {
    expect(percentOf(1, 3)).toBe(33.3);
    expect(percentOf(1, 0)).toBeNull();
  });
});

describe("timeline", () => {
  it("merges every source newest first and respects the limit", () => {
    const t = buildTimeline(
      [ev("s", "sign_in", "2026-10-20T01:00:00Z")],
      [att("s", "2026-10-20T03:00:00Z")],
      [done("s", "2026-10-20T02:00:00Z")],
    );
    expect(t.map((i) => i.type)).toEqual(["attempt", "completion", "event"]);
    expect(buildTimeline([ev("s", "sign_in", "1")], [att("s", "2")], [], 1)).toHaveLength(1);
  });
});

describe("format", () => {
  it("describes attempt results", () => {
    expect(attemptResult(att("s", "1", { score: 7, max_score: 10, passed: true }))).toBe("7/10 (70%) · passed");
    expect(attemptResult(att("s", "1", { status: "awaiting_marking" }))).toBe("awaiting marking");
  });

  it("describes elapsed time", () => {
    const now = new Date("2026-10-28T12:00:00Z");
    expect(timeAgo("2026-10-28T11:59:30Z", now)).toBe("just now");
    expect(timeAgo("2026-10-28T09:00:00Z", now)).toBe("3 hours ago");
    expect(timeAgo("2026-10-27T12:00:00Z", now)).toBe("1 day ago");
    expect(timeAgo("2026-10-14T12:00:00Z", now)).toBe("2 weeks ago");
  });
});
