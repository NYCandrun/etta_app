import { useMemo } from "react";
import katex from "katex";
import DOMPurify from "dompurify";

interface AccessibleMathProps {
  /** The LaTeX expression to render */
  latex: string;
  /** Whether to render as display math (block) or inline */
  display?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// Configure DOMPurify to allow KaTeX output elements and MathML
const PURIFY_CONFIG = {
  USE_PROFILES: { mathMl: true, html: true },
  ADD_TAGS: ["semantics", "annotation"] as string[],
  ADD_ATTR: ["encoding", "aria-hidden", "style"] as string[],
};

/**
 * Renders a LaTeX expression using KaTeX with MathML for accessibility.
 * Output is sanitized with DOMPurify to prevent XSS.
 * Falls back to a styled code block if KaTeX fails to parse.
 */
export function AccessibleMath({
  latex,
  display = false,
  className = "",
}: AccessibleMathProps) {
  const rendered = useMemo(() => {
    try {
      const rawHtml = katex.renderToString(latex, {
        displayMode: display,
        throwOnError: false,
        output: "htmlAndMathml",
        trust: false,
        strict: "warn",
      });
      // Sanitize KaTeX output to prevent XSS
      const html = DOMPurify.sanitize(rawHtml, PURIFY_CONFIG);
      return { html, error: false };
    } catch {
      return { html: "", error: true };
    }
  }, [latex, display]);

  if (rendered.error) {
    return (
      <code
        className={`rounded bg-warm-100 px-1.5 py-0.5 text-sm font-mono text-danger-600 dark:bg-warm-800 dark:text-danger-400 ${className}`}
        role="math"
        aria-label={latex}
      >
        {latex}
      </code>
    );
  }

  if (display) {
    return (
      <div
        className={`katex-display my-4 overflow-x-auto ${className}`}
        role="math"
        aria-label={latex}
        dangerouslySetInnerHTML={{ __html: rendered.html }}
      />
    );
  }

  return (
    <span
      className={`katex-inline ${className}`}
      role="math"
      aria-label={latex}
      dangerouslySetInnerHTML={{ __html: rendered.html }}
    />
  );
}
