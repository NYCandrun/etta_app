import { type ReactNode } from "react";
import type { LessonContent as LessonContentType } from "@/types/lesson";
import { parseLatexSegments } from "@/lib/katex-utils";
import { AccessibleMath } from "@/components/shared/AccessibleMath";
import { WorkedExample } from "@/components/lesson/WorkedExample";

interface LessonContentProps {
  lesson: LessonContentType;
  className?: string;
}

/**
 * Render a string that may contain both LaTeX and inline markdown (bold, italic, code).
 * LaTeX is parsed first so delimiters inside math are not treated as markdown.
 */
function renderRichInline(text: string, keyPrefix: string | number = 0): ReactNode[] {
  const segments = parseLatexSegments(text);
  const nodes: ReactNode[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    const key = `${keyPrefix}-${i}`;

    if (seg.type === "display-math") {
      nodes.push(<AccessibleMath key={key} latex={seg.content} display />);
    } else if (seg.type === "math") {
      nodes.push(<AccessibleMath key={key} latex={seg.content} />);
    } else {
      // Text segment: apply inline markdown formatting
      nodes.push(...renderInlineFormatting(seg.content, key));
    }
  }

  return nodes;
}

/**
 * Render inline markdown formatting (bold, italic, inline code) within a plain text string.
 */
function renderInlineFormatting(text: string, keyPrefix: string | number = 0): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Match **bold**, *italic*, and `code`
  const inlineRe = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = inlineRe.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      nodes.push(<strong key={`${keyPrefix}-b-${match.index}`}>{match[2]}</strong>);
    } else if (match[3]) {
      nodes.push(<em key={`${keyPrefix}-i-${match.index}`}>{match[3]}</em>);
    } else if (match[4]) {
      nodes.push(
        <code
          key={`${keyPrefix}-c-${match.index}`}
          className="rounded bg-warm-100 px-1 py-0.5 text-sm dark:bg-warm-800"
        >
          {match[4]}
        </code>
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

/**
 * Renders content that may contain markdown block structure (headings, lists, paragraphs)
 * mixed with LaTeX math expressions. Markdown is parsed at the line level first,
 * then LaTeX + inline formatting is applied within each block.
 */
function RichText({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let listItems: { text: string; ordered: boolean }[] = [];
  let blockKey = 0;
  let paragraphLines: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length > 0) {
      const content = paragraphLines.join(" ");
      blocks.push(
        <p key={`p-${blockKey++}`} className="my-2">
          {renderRichInline(content, blockKey)}
        </p>
      );
      paragraphLines = [];
    }
  };

  const flushList = () => {
    if (listItems.length > 0) {
      const isOrdered = listItems[0]?.ordered ?? false;
      const Tag = isOrdered ? "ol" : "ul";
      const listClass = isOrdered
        ? "my-2 list-decimal space-y-1 pl-6"
        : "my-2 list-disc space-y-1 pl-6";
      blocks.push(
        <Tag key={`list-${blockKey++}`} className={listClass}>
          {listItems.map((item, li) => (
            <li key={li}>{renderRichInline(item.text, `li-${blockKey}-${li}`)}</li>
          ))}
        </Tag>
      );
      listItems = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();

    // Headings: # through ####
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = headingMatch[1]!.length;
      const headingText = headingMatch[2]!;
      const sizeClass =
        level === 1
          ? "text-xl font-bold mt-6 mb-2"
          : level === 2
            ? "text-lg font-semibold mt-5 mb-2"
            : "text-base font-semibold mt-4 mb-1";
      const cls = `${sizeClass} text-warm-800 dark:text-warm-200`;
      const rendered = renderRichInline(headingText, `h-${blockKey}`);
      if (level === 1) {
        blocks.push(<h3 key={`h-${blockKey++}`} className={cls}>{rendered}</h3>);
      } else if (level === 2) {
        blocks.push(<h4 key={`h-${blockKey++}`} className={cls}>{rendered}</h4>);
      } else {
        blocks.push(<h5 key={`h-${blockKey++}`} className={cls}>{rendered}</h5>);
      }
      continue;
    }

    // Unordered list items (- or *)
    const ulMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (ulMatch) {
      flushParagraph();
      // If switching from ordered to unordered, flush
      if (listItems.length > 0 && listItems[0]?.ordered) flushList();
      listItems.push({ text: ulMatch[1]!, ordered: false });
      continue;
    }

    // Ordered list items (1. or 1))
    const olMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (olMatch) {
      flushParagraph();
      if (listItems.length > 0 && !listItems[0]?.ordered) flushList();
      listItems.push({ text: olMatch[1]!, ordered: true });
      continue;
    }

    // Empty line: paragraph break
    if (trimmed === "") {
      flushParagraph();
      flushList();
      continue;
    }

    // Regular text: accumulate into paragraph
    flushList();
    paragraphLines.push(trimmed);
  }

  flushParagraph();
  flushList();

  return <>{blocks}</>;
}

export function LessonContent({ lesson, className = "" }: LessonContentProps) {
  return (
    <article className={`max-w-3xl space-y-8 ${className}`}>
      {/* Title and summary */}
      <header>
        <h2 className="mb-2 text-2xl font-bold text-warm-900 dark:text-warm-100">
          {lesson.title}
        </h2>
        <p className="text-warm-500 dark:text-warm-400">
          <RichText text={lesson.summary} />
        </p>
      </header>

      {/* Sections */}
      {lesson.sections.map((section) => (
        <section key={section.id} className="space-y-3">
          <h3 className="text-lg font-semibold text-warm-800 dark:text-warm-200">
            {section.title}
          </h3>
          <div className="prose-warm text-warm-700 leading-relaxed dark:text-warm-300">
            <RichText text={section.content} />
          </div>
        </section>
      ))}

      {/* Worked examples */}
      {lesson.workedExamples.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-lg font-semibold text-warm-800 dark:text-warm-200">
            Worked Examples
          </h3>
          {lesson.workedExamples.map((example) => (
            <WorkedExample key={example.id} example={example} />
          ))}
        </section>
      )}
    </article>
  );
}

export { RichText };
