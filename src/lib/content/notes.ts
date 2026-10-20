/*
 * Tiny, safe Markdown subset for material notes:
 *   # / ## / ### headings, - or * bullets, 1. numbered lists,
 *   **bold**, *italic* or _italic_, `code`, [text](https://link),
 *   $inline maths$ and $$display maths$$ (LaTeX, rendered by KaTeX; \$ for a dollar sign)
 * Parsed to a plain AST and rendered as React elements — never as raw HTML.
 */

export type Inline =
  | { type: "text"; text: string }
  | { type: "bold"; children: Inline[] }
  | { type: "italic"; children: Inline[] }
  | { type: "code"; text: string }
  | { type: "link"; href: string; children: Inline[] }
  | { type: "math"; tex: string; display: boolean }
  | { type: "br" };

export type Block =
  | { type: "heading"; level: 1 | 2 | 3; children: Inline[] }
  | { type: "paragraph"; children: Inline[] }
  | { type: "list"; ordered: boolean; items: Inline[][] };

const SAFE_HREF = /^(https?:\/\/|mailto:)/i;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let buffer = "";
  const flush = () => {
    if (buffer) out.push({ type: "text", text: buffer });
    buffer = "";
  };

  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    let m: RegExpMatchArray | null;

    if (rest[0] === "\n") {
      flush();
      out.push({ type: "br" });
      i += 1;
    } else if (rest.startsWith("\\$")) {
      buffer += "$";
      i += 2;
    } else if ((m = rest.match(/^`([^`\n]+)`/))) {
      flush();
      out.push({ type: "code", text: m[1]! });
      i += m[0].length;
    } else if ((m = rest.match(/^\$\$([\s\S]+?)\$\$/))) {
      flush();
      out.push({ type: "math", tex: m[1]!.trim(), display: true });
      i += m[0].length;
    } else if ((m = rest.match(/^\$(\S(?:[^$\n]*?\S)?)\$/))) {
      // No space just inside the dollars, so "$5 and $10" stays plain text.
      flush();
      out.push({ type: "math", tex: m[1]!, display: false });
      i += m[0].length;
    } else if ((m = rest.match(/^\*\*([\s\S]+?)\*\*/))) {
      flush();
      out.push({ type: "bold", children: parseInline(m[1]!) });
      i += m[0].length;
    } else if ((m = rest.match(/^(\*|_)(\S(?:[\s\S]*?\S)?)\1/))) {
      flush();
      out.push({ type: "italic", children: parseInline(m[2]!) });
      i += m[0].length;
    } else if ((m = rest.match(/^\[([^\]\n]+)\]\(([^)\s]+)\)/))) {
      flush();
      if (SAFE_HREF.test(m[2]!)) out.push({ type: "link", href: m[2]!, children: parseInline(m[1]!) });
      else out.push({ type: "text", text: m[1]! }); // drop unsafe targets (javascript:, data:, …)
      i += m[0].length;
    } else {
      buffer += rest[0];
      i += 1;
    }
  }
  flush();
  return out;
}

export function parseNotes(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", children: parseInline(paragraph.join("\n")) });
    paragraph = [];
  };
  const flushList = () => {
    if (list) blocks.push({ type: "list", ordered: list.ordered, items: list.items.map(parseInline) });
    list = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    let m: RegExpMatchArray | null;

    if (!trimmed) {
      flushParagraph();
      flushList();
    } else if ((m = trimmed.match(/^(#{1,3})\s+(.*)$/))) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", level: m[1]!.length as 1 | 2 | 3, children: parseInline(m[2]!) });
    } else if ((m = trimmed.match(/^(?:([-*])|(\d+)[.)])\s+(.*)$/))) {
      flushParagraph();
      const ordered = Boolean(m[2]);
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push(m[3]!);
    } else {
      flushList();
      paragraph.push(trimmed);
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}
