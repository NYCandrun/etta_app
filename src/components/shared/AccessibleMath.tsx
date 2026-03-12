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

// Configure DOMPurify to allow KaTeX output elements
const PURIFY_CONFIG = {
  USE_PROFILES: { html: true },
  ADD_ATTR: ["aria-hidden", "style", "class"] as string[],
};

/**
 * Renders a LaTeX expression using KaTeX with HTML-only output.
 * Accessibility is provided via aria-label on the wrapper element.
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
        // Use HTML-only output. MathML is not needed because the wrapper
        // element carries role="math" and aria-label for screen readers.
        // "htmlAndMathml" caused visible duplication when MathML CSS was
        // missing or stripped by DOMPurify.
        output: "html",
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
