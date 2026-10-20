import { describe, expect, it } from "vitest";
import { accessSummary, allowedAt, grantedStudents, indexGrants, visibility } from "../access";
import { parseVideoUrl } from "../video";
import { parseInline, parseNotes } from "../notes";

const A = "student-a";
const B = "student-b";
const C = "student-c";

describe("access rules (mirror of the RLS policies)", () => {
  // The owner's example: Unit 1 → A,B,C; Subtopic 1 → A,B; PDF1 → A,B; PDF2 → A; PDF3 → B.
  const unit = { id: "u1", access_mode: "all" as const, is_published: true };
  const topic = { id: "t1", access_mode: "selected" as const, is_published: true };
  const pdfs = [
    { id: "p1", access_mode: "selected" as const, is_published: true },
    { id: "p2", access_mode: "selected" as const, is_published: true },
    { id: "p3", access_mode: "selected" as const, is_published: true },
  ];
  const index = indexGrants([
    { student_id: A, unit_id: null, topic_id: "t1", material_id: null },
    { student_id: B, unit_id: null, topic_id: "t1", material_id: null },
    { student_id: A, unit_id: null, topic_id: null, material_id: "p1" },
    { student_id: B, unit_id: null, topic_id: null, material_id: "p1" },
    { student_id: A, unit_id: null, topic_id: null, material_id: "p2" },
    { student_id: B, unit_id: null, topic_id: null, material_id: "p3" },
  ]);

  const visiblePdfs = (student: string) => {
    const uv = visibility(allowedAt(index, "unit", unit, student), unit.is_published, null);
    const tv = visibility(allowedAt(index, "topic", topic, student), topic.is_published, uv);
    return pdfs.filter((p) => visibility(allowedAt(index, "material", p, student), p.is_published, tv).visible).map((p) => p.id);
  };

  it("matches the owner's A/B/C example", () => {
    expect(visiblePdfs(A)).toEqual(["p1", "p2"]);
    expect(visiblePdfs(B)).toEqual(["p1", "p3"]);
    expect(visiblePdfs(C)).toEqual([]);
  });

  it("never lets a lower-level grant override a parent restriction", () => {
    const openMaterial = { id: "m", access_mode: "all" as const, is_published: true };
    const blockedTopic = visibility(allowedAt(index, "topic", topic, C), true, null);
    const v = visibility(allowedAt(index, "material", openMaterial, C), true, blockedTopic);
    expect(v).toEqual({ allowed: true, visible: false, blockedBy: "parent" });
  });

  it("hides unpublished items even when allowed", () => {
    expect(visibility(true, false, null)).toEqual({ allowed: true, visible: false, blockedBy: "unpublished" });
  });

  it("summarises access", () => {
    expect(grantedStudents(index, "topic", "t1").sort()).toEqual([A, B]);
    expect(accessSummary("all", 0)).toBe("All students");
    expect(accessSummary("selected", 0)).toBe("No students");
    expect(accessSummary("selected", 1)).toBe("1 student");
    expect(accessSummary("selected", 3)).toBe("3 students");
  });
});

describe("parseVideoUrl", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?t=10", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"],
    ["https://youtube.com/shorts/dQw4w9WgXcQ", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"],
    ["https://vimeo.com/76979871", "https://player.vimeo.com/video/76979871"],
  ])("embeds %s", (input, embed) => {
    expect(parseVideoUrl(input)).toMatchObject({ embedUrl: embed });
  });

  it("plays direct https video files", () => {
    expect(parseVideoUrl("https://cdn.example.com/a.mp4")).toEqual({ provider: "file", src: "https://cdn.example.com/a.mp4" });
  });

  it.each(["http://youtu.be/dQw4w9WgXcQ", "https://youtube.com/watch?v=bad", "https://example.com", "javascript:alert(1)", "nonsense"])(
    "rejects %s",
    (input) => {
      expect(parseVideoUrl(input)).toBeNull();
    }
  );
});

describe("notes formatting", () => {
  it("parses headings, lists and paragraphs", () => {
    const blocks = parseNotes("## Key ideas\n- one\n- two\n\n1. first\n2. second\n\nPlain text\nnext line");
    expect(blocks.map((b) => b.type)).toEqual(["heading", "list", "list", "paragraph"]);
    expect(blocks[1]).toMatchObject({ ordered: false });
    expect(blocks[2]).toMatchObject({ ordered: true });
  });

  it("parses inline formatting", () => {
    expect(parseInline("**F = ma** and *v* and `s`")).toEqual([
      { type: "bold", children: [{ type: "text", text: "F = ma" }] },
      { type: "text", text: " and " },
      { type: "italic", children: [{ type: "text", text: "v" }] },
      { type: "text", text: " and " },
      { type: "code", text: "s" },
    ]);
  });

  it("keeps safe links and strips dangerous ones", () => {
    expect(parseInline("[PhET](https://phet.colorado.edu)")[0]).toMatchObject({ type: "link", href: "https://phet.colorado.edu" });
    expect(parseInline("[click](javascript:alert(1))")[0]).toEqual({ type: "text", text: "click" });
  });

  it("treats HTML as plain text", () => {
    expect(parseInline("<script>alert(1)</script>")).toEqual([{ type: "text", text: "<script>alert(1)</script>" }]);
  });
});
