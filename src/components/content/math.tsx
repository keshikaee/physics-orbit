import katex from "katex";
import "katex/dist/katex.min.css";

/*
 * LaTeX via KaTeX. trust:false blocks \href, \url, \includegraphics and
 * HTML-producing commands, so the generated markup contains no links,
 * scripts or attributes from the author — safe to inject.
 */
export function MathTex({ tex, display = false }: { tex: string; display?: boolean }) {
  const html = katex.renderToString(tex, {
    displayMode: display,
    throwOnError: false,
    trust: false,
    strict: "ignore",
    maxSize: 20,
    maxExpand: 500,
    output: "htmlAndMathml",
  });
  return display ? (
    <span className="my-2 block overflow-x-auto" dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <span dangerouslySetInnerHTML={{ __html: html }} />
  );
}
