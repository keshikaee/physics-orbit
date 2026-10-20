import { describe, expect, it } from "vitest";
import { parseNumericAnswer } from "../numeric";
import { isLocked, orderSteps, progressOf, ruleSummary, stepStates } from "../progress";
import { answersSchema, quizSaveSchema, roadmapSaveSchema } from "../schemas";
import { parseInline } from "@/lib/content/notes";
import { stepVisibility, visibility } from "@/lib/content/access";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("parseNumericAnswer", () => {
  it.each([
    ["3.0e8", 3e8],
    ["3.0E8", 3e8],
    ["3.0 × 10^8", 3e8],
    ["3.0x10^-3", 3e-3],
    ["3*10^(−3)", 3e-3],
    ["1.5 × 10⁸", 1.5e8],
    ["2.5×10⁻³", 2.5e-3],
    ["−9.81", -9.81],
    [".5", 0.5],
    ["299 792 458", 299792458],
    ["6.63 \\times 10^-34", 6.63e-34],
  ])("reads %s", (raw, expected) => {
    expect(parseNumericAnswer(raw)).toBeCloseTo(expected, 15);
  });

  it.each(["", "abc", "1,5", "3e", "1.2.3", "10 m", "1/2", "e8"])("rejects %s", (raw) => {
    expect(parseNumericAnswer(raw)).toBeNull();
  });
});

describe("roadmap progress rules", () => {
  const step = (id: string, extra: Partial<Parameters<typeof isLocked>[0]> = {}) => ({
    id,
    is_required: true,
    lock_until_prereqs: false,
    pos_x: 0,
    pos_y: 0,
    ...extra,
  });

  it("locks only steps with prerequisite locking switched on", () => {
    const steps = [step("a"), step("b", { lock_until_prereqs: true }), step("c")];
    const edges = [
      { source_id: "a", target_id: "b" },
      { source_id: "a", target_id: "c" },
    ];
    const states = stepStates(steps, edges, new Set(), new Set());
    expect(states.get("b")).toBe("locked");
    expect(states.get("c")).toBe("not_started"); // no locking configured
    expect(stepStates(steps, edges, new Set(["a"]), new Set()).get("b")).toBe("not_started");
  });

  it("optional prerequisites and hidden steps never lock", () => {
    const steps = [step("opt", { is_required: false }), step("b", { lock_until_prereqs: true })];
    const edges = [
      { source_id: "opt", target_id: "b" },
      { source_id: "hidden", target_id: "b" }, // not in the student's step list
    ];
    expect(stepStates(steps, edges, new Set(), new Set()).get("b")).toBe("not_started");
  });

  it("completed beats in-progress; in-progress needs started work", () => {
    const steps = [step("a"), step("b")];
    const states = stepStates(steps, [], new Set(["a"]), new Set(["a", "b"]));
    expect(states.get("a")).toBe("completed");
    expect(states.get("b")).toBe("in_progress");
  });

  it("counts only required steps", () => {
    expect(progressOf([step("a"), step("b", { is_required: false }), step("c")], new Set(["a", "b"]))).toEqual({ done: 1, total: 2 });
  });

  it("orders steps along the arrows, left to right for ties, and survives cycles", () => {
    const steps = [step("end", { pos_x: 900 }), step("b2", { pos_x: 300, pos_y: 200 }), step("start"), step("b1", { pos_x: 300 }), step("loose", { pos_x: 50, pos_y: 500 })];
    const edges = [
      { source_id: "start", target_id: "b1" },
      { source_id: "start", target_id: "b2" },
      { source_id: "b1", target_id: "end" },
      { source_id: "b2", target_id: "end" },
    ];
    expect(orderSteps(steps, edges).map((s) => s.id)).toEqual(["start", "loose", "b1", "b2", "end"]);
    const cyclic = orderSteps([step("x", { pos_x: 1 }), step("y")], [
      { source_id: "x", target_id: "y" },
      { source_id: "y", target_id: "x" },
    ]);
    expect(cyclic.map((s) => s.id)).toEqual(["y", "x"]);
  });

  it("describes completion rules in plain language", () => {
    expect(ruleSummary("all_required", null, 2)).toBe("Pass all 2 required quizzes");
    expect(ruleSummary("min_quizzes", 3, 0)).toBe("Complete at least 3 quizzes");
    expect(ruleSummary("student_mark", null, 0)).toBe("Student marks it as done");
  });
});

describe("step visibility mirrors the database rule", () => {
  const vis = (visible: boolean) => ({ allowed: true, visible, blockedBy: null });
  it("needs the unit, linked subtopic, and at least one linked material", () => {
    expect(stepVisibility(true, true, vis(true), vis(true), []).visible).toBe(true);
    expect(stepVisibility(true, true, vis(true), vis(false), []).visible).toBe(false);
    expect(stepVisibility(true, true, vis(true), null, [vis(false), vis(true)]).visible).toBe(true);
    expect(stepVisibility(true, true, vis(true), null, [vis(false)]).visible).toBe(false);
    expect(stepVisibility(true, false, vis(true), null, []).blockedBy).toBe("unpublished");
    expect(stepVisibility(false, true, vis(true), null, []).visible).toBe(false);
    expect(stepVisibility(true, true, visibility(true, false, null), null, []).blockedBy).toBe("parent");
  });
});

describe("maths in notes and questions", () => {
  it("parses inline and display LaTeX before italics", () => {
    expect(parseInline("Use $v_x = u_x + a_x t$ here")).toEqual([
      { type: "text", text: "Use " },
      { type: "math", tex: "v_x = u_x + a_x t", display: false },
      { type: "text", text: " here" },
    ]);
    expect(parseInline("$$E = mc^2$$")).toEqual([{ type: "math", tex: "E = mc^2", display: true }]);
  });
  it("leaves prices and escaped dollars as text", () => {
    expect(parseInline("costs $5 and $10")).toEqual([{ type: "text", text: "costs $5 and $10" }]);
    expect(parseInline("\\$x\\$")).toEqual([{ type: "text", text: "$x$" }]);
  });
});

describe("roadmap and quiz validation", () => {
  const node = (n: number, extra = {}) => ({ id: uuid(n), kind: "lesson", title: `Step ${n}`, x: 0, y: 0, completionRule: "student_mark", ...extra });

  it("accepts a valid roadmap, drops duplicate connections, normalises rules", () => {
    const r = roadmapSaveSchema.parse({
      roadmapId: uuid(99),
      version: 1,
      nodes: [node(1, { completionRule: "min_quizzes" }), node(2, { accessMode: "all", studentIds: [uuid(5)] })],
      edges: [
        { source: uuid(1), target: uuid(2) },
        { source: uuid(1), target: uuid(2) },
      ],
    });
    expect(r.edges).toHaveLength(1);
    expect(r.nodes[0]!.minQuizzes).toBe(1);
    expect(r.nodes[1]!.studentIds).toEqual([]); // "all" ignores the student list
  });

  it("rejects self-connections, dangling connections and duplicate steps", () => {
    const base = { roadmapId: uuid(99), version: 1 };
    expect(roadmapSaveSchema.safeParse({ ...base, nodes: [node(1)], edges: [{ source: uuid(1), target: uuid(1) }] }).success).toBe(false);
    expect(roadmapSaveSchema.safeParse({ ...base, nodes: [node(1)], edges: [{ source: uuid(1), target: uuid(2) }] }).success).toBe(false);
    expect(roadmapSaveSchema.safeParse({ ...base, nodes: [node(1), node(1)], edges: [] }).success).toBe(false);
  });

  const quiz = (questions: unknown[], extra = {}) => ({
    id: uuid(50),
    nodeId: uuid(1),
    title: "Quiz",
    passPercent: 60,
    maxAttempts: null,
    reveal: "after_submit",
    requirePass: true,
    isRequired: true,
    isPublished: true,
    questions,
    ...extra,
  });
  const mcq = (correct: string[], kind = "mcq_single") => ({
    id: uuid(10),
    kind,
    prompt: "Pick",
    marks: 1,
    choices: [
      { id: uuid(11), label: "A" },
      { id: uuid(12), label: "B" },
    ],
    key: { correctChoiceIds: correct },
  });

  it("checks multiple-choice keys", () => {
    expect(quizSaveSchema.safeParse(quiz([mcq([uuid(11)])])).success).toBe(true);
    expect(quizSaveSchema.safeParse(quiz([mcq([uuid(11), uuid(12)])])).success).toBe(false);
    expect(quizSaveSchema.safeParse(quiz([mcq([uuid(11), uuid(12)], "mcq_multi")])).success).toBe(true);
    expect(quizSaveSchema.safeParse(quiz([mcq([uuid(77)])])).success).toBe(false); // not one of its choices
  });

  it("needs a numeric answer, accepted answers for exact match, and questions before publishing", () => {
    expect(quizSaveSchema.safeParse(quiz([{ id: uuid(20), kind: "numeric", prompt: "g?", marks: 1, key: {} }])).success).toBe(false);
    expect(quizSaveSchema.safeParse(quiz([{ id: uuid(20), kind: "short", prompt: "Law?", marks: 2, key: { autoExact: true } }])).success).toBe(false);
    expect(quizSaveSchema.safeParse(quiz([])).success).toBe(false);
    expect(quizSaveSchema.safeParse(quiz([], { isPublished: false })).success).toBe(true);
  });

  it("only accepts question images in the quiz image folder", () => {
    const q = { ...mcq([uuid(11)]), imagePath: "../../etc/passwd" };
    expect(quizSaveSchema.safeParse(quiz([q])).success).toBe(false);
    expect(quizSaveSchema.safeParse(quiz([{ ...q, imagePath: `quiz/${uuid(50)}/${uuid(60)}.png` }])).success).toBe(true);
  });

  it("accepts answers keyed by question id and nothing else", () => {
    expect(answersSchema.safeParse({ [uuid(1)]: { choices: [uuid(2)] }, [uuid(3)]: { value: 3e8, unit: "m/s", raw: "3e8" } }).success).toBe(true);
    expect(answersSchema.safeParse({ notAnId: { text: "x" } }).success).toBe(false);
    expect(answersSchema.safeParse({ [uuid(1)]: { score: 10 } }).success).toBe(false);
  });
});
