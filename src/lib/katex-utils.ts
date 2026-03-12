/**
 * LaTeX parsing utilities for Astrolabe.
 *
 * Parses markdown text containing LaTeX delimiters and splits it into
 * segments of plain text and math content.
 *
 * Supported delimiters:
 *   Inline:  $...$  and  \(...\)
 *   Display: $$...$$ and \[...\]
 */

export type SegmentType = "text" | "math" | "display-math";

export interface Segment {
  type: SegmentType;
  content: string;
}

/**
 * Patterns ordered by priority. Display math must match before inline.
 *
 * Each pattern has:
 *  - regex: the pattern to match (with dotAll semantics simulated via [\s\S])
 *  - type: the resulting segment type
 */
interface DelimiterPattern {
  regex: RegExp;
  type: SegmentType;
}

const PATTERNS: DelimiterPattern[] = [
  // $$...$$ display math (greedy only to next $$)
  { regex: /\$\$([\s\S]+?)\$\$/, type: "display-math" },
  // \[...\] display math
  { regex: /\\\[([\s\S]+?)\\\]/, type: "display-math" },
  // $...$ inline math (not preceded/followed by $, skip currency like $10 or $5.99)
  { regex: /(?<!\$)\$(?!\$)(?!\d+(?:[.,]\d+)*(?:[^$\\]|$))((?:[^$\\]|\\.)+?)\$(?!\$)/, type: "math" },
  // \(...\) inline math
  { regex: /\\\(([\s\S]+?)\\\)/, type: "math" },
  // Bare \begin{...}...\end{...} blocks (display math)
  { regex: /\\begin\{(\w+)\}([\s\S]*?)\\end\{\1\}/, type: "display-math" },
];

/**
 * Build a combined regex that matches the earliest delimiter in the string.
 * Returns the match along with which pattern produced it.
 */
function findEarliestMatch(
  text: string
): { index: number; fullMatch: string; content: string; type: SegmentType } | null {
  let best: {
    index: number;
    fullMatch: string;
    content: string;
    type: SegmentType;
  } | null = null;

  for (const pattern of PATTERNS) {
    const m = pattern.regex.exec(text);
    if (m) {
      const content = m[1] ?? m[0];

      if (best === null || m.index < best.index) {
        best = {
          index: m.index,
          fullMatch: m[0],
          content,
          type: pattern.type,
        };
      }
    }
  }

  return best;
}

/**
 * Sanitize potentially malformed LaTeX by balancing common environments
 * and stripping obviously broken commands.
 */
function sanitizeLatex(latex: string): string {
  let result = latex.trim();

  // Balance braces
  let depth = 0;
  for (const ch of result) {
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
  }
  if (depth > 0) {
    result += "}".repeat(depth);
  } else if (depth < 0) {
    result = "{".repeat(-depth) + result;
  }

  // Balance \begin{...} and \end{...}
  const beginRe = /\\begin\{(\w+)\}/g;
  const endRe = /\\end\{(\w+)\}/g;
  const opens: string[] = [];
  let m: RegExpExecArray | null;

  while ((m = beginRe.exec(result)) !== null) {
    opens.push(m[1]!);
  }
  while ((m = endRe.exec(result)) !== null) {
    const idx = opens.indexOf(m[1]!);
    if (idx !== -1) opens.splice(idx, 1);
  }
  // Close any unclosed environments
  for (const env of opens.reverse()) {
    result += `\\end{${env}}`;
  }

  return result;
}

/**
 * Parse a string containing mixed text and LaTeX into an array of segments.
 *
 * @param input The raw markdown/text string possibly containing LaTeX delimiters.
 * @returns Array of segments with type and content.
 */
export function parseLatexSegments(input: string): Segment[] {
  if (!input) return [];

  const segments: Segment[] = [];
  let remaining = input;

  while (remaining.length > 0) {
    const match = findEarliestMatch(remaining);

    if (!match) {
      // No more math — rest is plain text
      segments.push({ type: "text", content: remaining });
      break;
    }

    // Text before the match
    if (match.index > 0) {
      segments.push({
        type: "text",
        content: remaining.slice(0, match.index),
      });
    }

    // The math segment, sanitized
    segments.push({
      type: match.type,
      content: sanitizeLatex(match.content),
    });

    // Advance past the match
    remaining = remaining.slice(match.index + match.fullMatch.length);
  }

  // Merge adjacent text segments
  const merged: Segment[] = [];
  for (const seg of segments) {
    const last = merged[merged.length - 1];
    if (seg.type === "text" && last?.type === "text") {
      last.content += seg.content;
    } else {
      merged.push(seg);
    }
  }

  return merged;
}

/**
 * Quick check if a string likely contains LaTeX.
 */
export function containsLatex(text: string): boolean {
  return /\$[^$]|\\\(|\\\[|\\begin\{|\\(?:frac|sqrt|sum|int|lim|alpha|beta|gamma|delta|theta|pi|sigma|infty)\b/.test(text);
}
