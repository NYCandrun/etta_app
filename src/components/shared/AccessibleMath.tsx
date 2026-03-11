import { useMemo } from "react";
import katex from "katex";

interface AccessibleMathProps {
  /** The LaTeX expression to render */
  latex: string;
  /** Whether to render as display math (block) or inline */
  display?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Renders a LaTeX expression using KaTeX with MathML for accessibility.
 * Falls back to a styled code block if KaTeX fails to parse.
 */
export function AccessibleMath({
  latex,
  display = false,
  className = "",
}: AccessibleMathProps) {
  const rendered = useMemo(() => {
    try {
      const html = katex.renderToString(latex, {
        displayMode: display,
        throwOnError: false,
        output: "htmlAndMathml",
        trust: false,
        strict: "warn",
      });
      return { html, error: false };
    } catch {
      return { html: "", error: true };
    }
  }, [latex, display]);

  if (rendered.error) {
    console.warn("[AccessibleMath] KaTeX failed to parse:", latex);
    return (
      <span
        className={`inline-block rounded bg-warm-100 px-1.5 py-0.5 text-sm italic text-warm-500 dark:bg-warm-800 dark:text-warm-400 ${className}`}
      >
        Math display error
      </span>
    );
  }

  if (display) {
    return (
      <div
        className={`katex-display my-6 overflow-x-auto text-center ${className}`}
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
