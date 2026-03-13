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
 * Strip HTML comments (e.g. <!-- mastery_band:low -->) from text.
 */
function stripHtmlComments(text: string): string {
  return text.replace(/<!--[\s\S]*?-->/g, "").trim();
}

/**
 * Detect a flattened markdown table (all rows on one line) and split into separate lines.
 * AI responses sometimes return tables without proper newlines between rows.
 */
function unflattenTableLines(text: string): string {
  return text.split("\n").map((line) => {
    const trimmed = line.trim();
    // Quick check: must contain pipes and a separator pattern (e.g. |---|)
    if (!trimmed.includes("|") || !/\|[\s]*:?-{2,}:?[\s]*\|/.test(trimmed)) {
      return line;
    }
    // Only process lines that look like a flattened table (separator embedded in longer content)
    const sepRegex = /(\|[\s]*:?-{2,}:?[\s]*(?:\|[\s]*:?-{2,}:?[\s]*)*\|)/;
    const sepMatch = trimmed.match(sepRegex);
    if (!sepMatch) return line;

    // Count columns from the separator row
    const numCols = sepMatch[0].split("|").filter((s) => s.trim().length > 0).length;
    if (numCols === 0) return line;

    const sepStart = sepMatch.index!;
    const sepEnd = sepStart + sepMatch[0].length;

    const before = trimmed.slice(0, sepStart).trim();
    const separator = sepMatch[0].trim();
    const after = trimmed.slice(sepEnd).trim();

    // Only unflatten if there's actually content before or after the separator on this line
    if (!before && !after) return line;

    const rows: string[] = [];
    if (before) rows.push(...splitIntoTableRows(before, numCols));
    rows.push(separator);
    if (after) rows.push(...splitIntoTableRows(after, numCols));

    return rows.join("\n");
  }).join("\n");
}

/**
 * Split a concatenated string of table rows into individual rows based on column count.
 * Handles LaTeX pipes inside $...$ by skipping them when counting.
 */
function splitIntoTableRows(text: string, numCols: number): string[] {
  const rows: string[] = [];
  let remaining = text.trim();

  while (remaining.length > 0) {
    if (!remaining.startsWith("|")) {
      // Not a proper row start — include as-is
      rows.push(remaining);
      break;
    }

    // Count pipes, skipping those inside $...$ math delimiters
    let pipeCount = 0;
    let inMath = false;
    let endIdx = -1;

    for (let i = 0; i < remaining.length; i++) {
      const ch = remaining[i]!;
      if (ch === "$" && (i === 0 || remaining[i - 1] !== "\\")) {
        inMath = !inMath;
        continue;
      }
      if (ch === "|" && !inMath) {
        pipeCount++;
        if (pipeCount === numCols + 1) {
          endIdx = i;
          break;
        }
      }
    }

    if (endIdx === -1) {
      rows.push(remaining);
      break;
    }

    rows.push(remaining.slice(0, endIdx + 1).trim());
    remaining = remaining.slice(endIdx + 1).trim();
  }

  return rows;
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
 * Bold (**) is matched before italic (*) to handle nesting correctly.
 * Uses word-boundary-aware patterns to avoid matching stray asterisks.
 */
function renderInlineFormatting(text: string, keyPrefix: string | number = 0): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Match `code` first, then **bold** (with proper closing), then *italic*
  // The bold/italic patterns require non-space after opening and before closing markers
  const inlineRe = /(`(.+?)`|\*\*([^\s*](?:[^]*?[^\s*])?)\*\*|\*([^\s*](?:[^]*?[^\s*])?)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = inlineRe.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      nodes.push(
        <code
          key={`${keyPrefix}-c-${match.index}`}
          className="rounded bg-warm-100 px-1 py-0.5 text-sm dark:bg-warm-800"
        >
          {match[2]}
        </code>
      );
    } else if (match[3]) {
      nodes.push(<strong key={`${keyPrefix}-b-${match.index}`}>{match[3]}</strong>);
    } else if (match[4]) {
      nodes.push(<em key={`${keyPrefix}-i-${match.index}`}>{match[4]}</em>);
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

/**
 * Parse a markdown table row into cell strings.
 * Handles rows like "| cell1 | cell2 |" or "cell1 | cell2".
 */
function parseTableRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((cell) => cell.trim());
}

/**
 * Check if a line is a table separator row (e.g. "|---|---|" or "---|---").
 */
function isTableSeparator(line: string): boolean {
  return /^\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?$/.test(line.trim());
}

/**
 * Renders content that may contain markdown block structure (headings, lists, paragraphs, tables)
 * mixed with LaTeX math expressions. Markdown is parsed at the line level first,
 * then LaTeX + inline formatting is applied within each block.
 */
function RichText({ text }: { text: string }) {
  // Preprocess: strip HTML comments and unflatten any single-line tables
  const cleaned = unflattenTableLines(stripHtmlComments(text));
  const lines = cleaned.split("\n");
  const blocks: ReactNode[] = [];
  let listItems: { text: string; ordered: boolean }[] = [];
  let blockKey = 0;
  let paragraphLines: string[] = [];
  let tableLines: string[] = [];

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

  const flushTable = () => {
    if (tableLines.length === 0) return;

    // Find separator row to split header from body
    let separatorIdx = -1;
    for (let t = 0; t < tableLines.length; t++) {
      if (isTableSeparator(tableLines[t]!)) {
        separatorIdx = t;
        break;
      }
    }

    const headerRows = separatorIdx > 0 ? tableLines.slice(0, separatorIdx) : [];
    const bodyRows =
      separatorIdx >= 0
        ? tableLines.slice(separatorIdx + 1)
        : tableLines;

    const tKey = blockKey++;
    blocks.push(
      <div key={`tw-${tKey}`} className="my-4 overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          {headerRows.length > 0 && (
            <thead>
              {headerRows.map((row, ri) => {
                const cells = parseTableRow(row);
                return (
                  <tr key={ri} className="border-b-2 border-warm-300 dark:border-warm-600">
                    {cells.map((cell, ci) => (
                      <th
                        key={ci}
                        className="px-3 py-2 text-left font-semibold text-warm-800 dark:text-warm-200"
                      >
                        {renderRichInline(cell, `th-${tKey}-${ri}-${ci}`)}
                      </th>
                    ))}
                  </tr>
                );
              })}
            </thead>
          )}
          <tbody>
            {bodyRows
              .filter((row) => row.trim() !== "")
              .map((row, ri) => {
                const cells = parseTableRow(row);
                return (
                  <tr
                    key={ri}
                    className="border-b border-warm-200 dark:border-warm-700"
                  >
                    {cells.map((cell, ci) => (
                      <td
                        key={ci}
                        className="px-3 py-2 text-warm-700 dark:text-warm-300"
                      >
                        {renderRichInline(cell, `td-${tKey}-${ri}-${ci}`)}
                      </td>
                    ))}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    );
    tableLines = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();

    // Table rows: lines starting and ending with |, or separator rows,
    // or continuation rows when we're already accumulating a table
    const isTableRow =
      /^\|.+\|$/.test(trimmed) ||
      isTableSeparator(trimmed) ||
      (tableLines.length > 0 && trimmed.includes("|") && !trimmed.startsWith("#"));
    if (isTableRow) {
      flushParagraph();
      flushList();
      tableLines.push(trimmed);
      continue;
    }

    // If we were accumulating table lines but this line isn't a table row, flush
    if (tableLines.length > 0) {
      flushTable();
    }

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

    // Horizontal rule: --- or *** or ___
    if (/^[-*_]{3,}$/.test(trimmed)) {
      flushParagraph();
      flushList();
      blocks.push(<hr key={`hr-${blockKey++}`} className="my-4 border-warm-200 dark:border-warm-700" />);
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
  flushTable();

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
