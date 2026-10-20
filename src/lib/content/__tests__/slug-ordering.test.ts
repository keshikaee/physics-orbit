import { describe, expect, it } from "vitest";
import { SLUG_PATTERN, slugify, uniqueSlug } from "../slug";
import { nextOrderIndex, planMove } from "../ordering";

describe("slugify", () => {
  it.each([
    ["Newton's Laws & Forces", "newtons-laws-forces"],
    ["  Work, Energy and Power  ", "work-energy-and-power"],
    ["Force–extension graphs", "force-extension-graphs"],
    ["Café Résumé", "cafe-resume"],
    ["!!!", "untitled"],
  ])("%s → %s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it("always produces a slug the database accepts", () => {
    for (const s of ["a--b", "-x-", "Ünit 1: Mechanics", "x".repeat(200) + " y"]) {
      const slug = slugify(s);
      expect(slug).toMatch(SLUG_PATTERN);
      expect(slug.length).toBeLessThanOrEqual(80);
    }
  });
});

describe("uniqueSlug", () => {
  it("returns the base when free", () => {
    expect(uniqueSlug("kinematics", ["forces"])).toBe("kinematics");
  });
  it("appends a counter when taken", () => {
    expect(uniqueSlug("kinematics", ["kinematics", "kinematics-2"])).toBe("kinematics-3");
  });
});

describe("planMove", () => {
  const items = [
    { id: "a", order_index: 1 },
    { id: "b", order_index: 2 },
    { id: "c", order_index: 3 },
  ];

  it("swaps with the previous item when moving up", () => {
    expect(planMove(items, "b", "up")).toEqual([
      { id: "b", order_index: 1 },
      { id: "a", order_index: 2 },
    ]);
  });

  it("swaps with the next item when moving down", () => {
    expect(planMove(items, "b", "down")).toEqual([
      { id: "c", order_index: 2 },
      { id: "b", order_index: 3 },
    ]);
  });

  it("is a no-op at the edges or for unknown ids", () => {
    expect(planMove(items, "a", "up")).toEqual([]);
    expect(planMove(items, "c", "down")).toEqual([]);
    expect(planMove(items, "zzz", "up")).toEqual([]);
  });

  it("normalises gaps and duplicate indexes", () => {
    const messy = [
      { id: "a", order_index: 10 },
      { id: "b", order_index: 10 },
      { id: "c", order_index: 40 },
    ];
    const updates = planMove(messy, "c", "up");
    const final = new Map(messy.map((i) => [i.id, i.order_index]));
    updates.forEach((u) => final.set(u.id, u.order_index));
    expect([...final.entries()].sort((x, y) => x[1] - y[1]).map(([id]) => id)).toEqual(["a", "c", "b"]);
    expect(new Set(final.values()).size).toBe(3);
  });
});

describe("nextOrderIndex", () => {
  it("appends after the current maximum", () => {
    expect(nextOrderIndex([])).toBe(1);
    expect(nextOrderIndex([{ id: "a", order_index: 4 }, { id: "b", order_index: 2 }])).toBe(5);
  });
});
