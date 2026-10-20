import { parseNotes, type Block, type Inline } from "@/lib/content/notes";
import { cn } from "@/lib/utils";
import { MathTex } from "./math";

/* Renders material notes from the safe Markdown subset — React elements only, no raw HTML. */

function InlineNodes({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.type) {
          case "text":
            return <span key={i}>{n.text}</span>;
          case "br":
            return <br key={i} />;
          case "math":
            return <MathTex key={i} tex={n.tex} display={n.display} />;
          case "code":
            return (
              <code key={i} className="rounded bg-orbit-panel px-1.5 py-0.5 font-mono text-[0.9em] text-orbit-text">
                {n.text}
              </code>
            );
          case "bold":
            return (
              <strong key={i} className="font-semibold text-orbit-text">
                <InlineNodes nodes={n.children} />
              </strong>
            );
          case "italic":
            return (
              <em key={i}>
                <InlineNodes nodes={n.children} />
              </em>
            );
          case "link":
            return (
              <a
                key={i}
                href={n.href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="font-medium text-orbit-primary-text underline underline-offset-2 hover:text-orbit-primary-hover"
              >
                <InlineNodes nodes={n.children} />
              </a>
            );
        }
      })}
    </>
  );
}

function BlockNode({ block }: { block: Block }) {
  if (block.type === "heading") {
    const Tag = (["h3", "h4", "h5"] as const)[block.level - 1];
    return (
      <Tag className={cn("font-semibold text-orbit-text", block.level === 1 ? "text-lg" : "text-base")}>
        <InlineNodes nodes={block.children} />
      </Tag>
    );
  }
  if (block.type === "list") {
    const Tag = block.ordered ? "ol" : "ul";
    return (
      <Tag className={cn("space-y-1 pl-5", block.ordered ? "list-decimal" : "list-disc")}>
        {block.items.map((item, i) => (
          <li key={i}>
            <InlineNodes nodes={item} />
          </li>
        ))}
      </Tag>
    );
  }
  return (
    <p>
      <InlineNodes nodes={block.children} />
    </p>
  );
}

/** Inline-only rendering (quiz prompts, answer choices): bold/italic/code/links/maths, no blocks. */
export function RichText({ source, className }: { source: string; className?: string }) {
  const blocks = parseNotes(source);
  return (
    <span className={className}>
      {blocks.map((b, i) => (
        <span key={i} className={i > 0 ? "mt-2 block" : undefined}>
          {b.type === "list" ? (
            b.items.map((item, j) => (
              <span key={j} className="block">
                • <InlineNodes nodes={item} />
              </span>
            ))
          ) : (
            <InlineNodes nodes={b.children} />
          )}
        </span>
      ))}
    </span>
  );
}

export function NotesView({ source, className }: { source: string; className?: string }) {
  const blocks = parseNotes(source);
  if (!blocks.length) return null;
  return (
    <div className={cn("space-y-3 text-[15px] leading-relaxed text-orbit-text-secondary", className)}>
      {blocks.map((b, i) => (
        <BlockNode key={i} block={b} />
      ))}
    </div>
  );
}
