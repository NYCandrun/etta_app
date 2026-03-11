import { AccessibleMath } from "@/components/shared/AccessibleMath";

interface LatexBlockProps {
  /** The LaTeX expression (without delimiters) */
  latex: string;
  /** Inline or display mode */
  display?: boolean;
  className?: string;
}

/**
 * Renders a single LaTeX expression via KaTeX.
 * Wraps AccessibleMath with appropriate styling.
 */
export function LatexBlock({
  latex,
  display = false,
  className = "",
}: LatexBlockProps) {
  if (display) {
    return (
      <div className={`my-4 overflow-x-auto ${className}`}>
        <AccessibleMath latex={latex} display />
      </div>
    );
  }

  return <AccessibleMath latex={latex} className={className} />;
}
