import { describe, expect, it } from "vitest";
import { accessSchema, materialCreateSchema, moveSchema, topicCreateSchema, unitUpdateSchema } from "../schemas";

const id = "6f1c1c8e-1d3a-4b5e-9a2f-0c7e8d9b1a23";

describe("unitUpdateSchema", () => {
  it("parses checkboxes: present → true, absent → false", () => {
    const r = unitUpdateSchema.parse({ unitId: id, code: "Unit 1", title: "Mechanics", isPublished: "on" });
    expect(r.isPublished).toBe(true);
    expect(r.isPlaceholder).toBe(false);
    expect(r.reviewed).toBe(false);
    expect(r.description).toBe("");
  });

  it("rejects a non-uuid id", () => {
    expect(unitUpdateSchema.safeParse({ unitId: "1 or 1=1", code: "U", title: "T" }).success).toBe(false);
  });

  it("trims and requires a title", () => {
    expect(unitUpdateSchema.safeParse({ unitId: id, code: "U", title: "   " }).success).toBe(false);
  });
});

describe("topicCreateSchema", () => {
  it("caps description length", () => {
    expect(topicCreateSchema.safeParse({ unitId: id, title: "T", description: "x".repeat(2001) }).success).toBe(false);
  });
});

describe("moveSchema", () => {
  it("only allows up or down, for known content kinds", () => {
    expect(moveSchema.safeParse({ kind: "topic", id, direction: "up" }).success).toBe(true);
    expect(moveSchema.safeParse({ kind: "topic", id, direction: "sideways" }).success).toBe(false);
    expect(moveSchema.safeParse({ kind: "course", id, direction: "up" }).success).toBe(false);
  });
});

describe("accessSchema", () => {
  it("drops student ids when access is for all students", () => {
    expect(accessSchema.parse({ accessMode: "all", studentIds: [id] }).studentIds).toEqual([]);
  });

  it("keeps unique ids for selected students and rejects non-uuids", () => {
    expect(accessSchema.parse({ accessMode: "selected", studentIds: [id, id] }).studentIds).toEqual([id]);
    expect(accessSchema.safeParse({ accessMode: "selected", studentIds: ["1 or 1=1"] }).success).toBe(false);
  });
});

describe("materialCreateSchema", () => {
  const base = { topicId: id, title: "Kinematics notes" };
  const issuePaths = (input: object) => {
    const r = materialCreateSchema.safeParse(input);
    return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
  };

  it("requires the right source for each type", () => {
    expect(issuePaths({ ...base, kind: "pdf" })).toContain("file");
    expect(issuePaths({ ...base, kind: "link" })).toContain("url");
    expect(issuePaths({ ...base, kind: "note" })).toContain("notes");
    expect(issuePaths({ ...base, kind: "video" })).toContain("url");
  });

  it("accepts valid materials, with notes optional", () => {
    expect(issuePaths({ ...base, kind: "link", url: "https://phet.colorado.edu" })).toEqual([]);
    expect(issuePaths({ ...base, kind: "note", notes: "Remember **units**." })).toEqual([]);
    expect(issuePaths({ ...base, kind: "video", url: "https://youtu.be/dQw4w9WgXcQ" })).toEqual([]);
    expect(issuePaths({ ...base, kind: "pdf", storagePath: `${id}/${id}.pdf`, fileName: "a.pdf", fileSize: "10", mimeType: "application/pdf" })).toEqual([]);
  });

  it("rejects unsafe or unplayable URLs", () => {
    expect(issuePaths({ ...base, kind: "link", url: "javascript:alert(1)" })).toContain("url");
    expect(issuePaths({ ...base, kind: "video", url: "https://example.com/page" })).toContain("url");
  });
});
