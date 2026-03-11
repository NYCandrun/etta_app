import { Fragment, type ReactNode } from "react";
import type { LessonContent as LessonContentType } from "@/types/lesson";
import { parseLatexSegments } from "@/lib/katex-utils";
import { AccessibleMath } from "@/components/shared/AccessibleMath";
import { WorkedExample } from "@/components/lesson/WorkedExample";

interface LessonContentProps {
  lesson: LessonContentType;
  className?: string;
}

/**
 * Render inline markdown formatting (bold, italic, inline code) within a text string.
 * Does NOT handle block-level elements — those are handled by renderMarkdownBlocks.
 */
function renderInlineFormatting(text: string): ReactNode[] {
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
      nodes.push(<strong key={match.index}>{match[2]}</strong>);
    } else if (match[3]) {
      nodes.push(<em key={match.index}>{match[3]}</em>);
    } else if (match[4]) {
      nodes.push(
        <code
          key={match.index}
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
 * Renders text segments with markdown block structure (headings, lists, paragraphs).
 */
function renderTextBlock(content: string, key: number): ReactNode {
  const lines = content.split("\n");
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];
  let blockKey = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push(
        <ul key={`${key}-list-${blockKey++}`} className="my-2 list-disc space-y-1 pl-6">
          {listItems.map((item, li) => (
            <li key={li}>{renderInlineFormatting(item)}</li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();

    // Headings
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
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
      const rendered = renderInlineFormatting(headingText);
      if (level === 1) {
        blocks.push(<h3 key={`${key}-h-${blockKey++}`} className={cls}>{rendered}</h3>);
      } else if (level === 2) {
        blocks.push(<h4 key={`${key}-h-${blockKey++}`} className={cls}>{rendered}</h4>);
      } else {
        blocks.push(<h5 key={`${key}-h-${blockKey++}`} className={cls}>{rendered}</h5>);
      }
      continue;
    }

    // List items (- or *)
    const listMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (listMatch) {
      listItems.push(listMatch[1]!);
      continue;
    }

    // Numbered list items
    const numListMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (numListMatch) {
      listItems.push(numListMatch[1]!);
      continue;
    }

    // Empty line: flush and add paragraph break
    if (trimmed === "") {
      flushList();
      continue;
    }

    // Regular text
    flushList();
    blocks.push(
      <Fragment key={`${key}-p-${blockKey++}`}>
        {renderInlineFormatting(trimmed)}
        {i < lines.length - 1 && lines[i + 1]?.trim() !== "" ? " " : null}
      </Fragment>
    );
  }

  flushList();
  return <>{blocks}</>;
}

/**
 * Renders a paragraph of text that may contain inline and display LaTeX,
 * as well as markdown formatting (headings, bold, italic, lists).
 */
function RichText({ text }: { text: string }) {
  const segments = parseLatexSegments(text);

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === "text") {
          return <Fragment key={i}>{renderTextBlock(seg.content, i)}</Fragment>;
        }
        if (seg.type === "display-math") {
          return (
            <AccessibleMath key={i} latex={seg.content} display />
          );
        }
        return <AccessibleMath key={i} latex={seg.content} />;
      })}
    </>
  );
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
