import { useState } from "react";
import type { Question } from "@/types/quiz";
import { parseLatexSegments } from "@/lib/katex-utils";
import { AccessibleMath } from "@/components/shared/AccessibleMath";

interface FillInBlankProps {
  question: Question;
  onSubmit: (blanks: string[]) => void;
  submitted: boolean;
  correctAnswers?: string[];
  className?: string;
}

/**
 * Renders a sentence with embedded input fields for blanks.
 * Blanks are indicated by ___BLANK___ markers in the prompt.
 */
export function FillInBlank({
  question,
  onSubmit,
  submitted,
  correctAnswers,
  className = "",
}: FillInBlankProps) {
  const blankCount = question.blanks?.length ?? 1;
  const [answers, setAnswers] = useState<string[]>(
    Array.from({ length: blankCount }, () => "")
  );

  const updateAnswer = (index: number, value: string) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const allFilled = answers.every((a) => a.trim().length > 0);

  // Split the prompt on blank markers
  const parts = question.prompt.split(/___BLANK___|\{BLANK\}|\[BLANK\]/);
  let blankIndex = 0;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Sentence with inline blanks */}
      <div className="text-lg leading-relaxed text-warm-900 dark:text-warm-100">
        {parts.map((part, i) => {
          const segments = parseLatexSegments(part);
          const currentBlankIndex = blankIndex;
          const showBlank = i < parts.length - 1;
          if (showBlank) blankIndex++;

          return (
            <span key={i}>
              {/* Text/math segments */}
              {segments.map((seg, j) => {
                if (seg.type === "text") {
                  return <span key={j}>{seg.content}</span>;
                }
                return (
                  <AccessibleMath
                    key={j}
                    latex={seg.content}
                    display={seg.type === "display-math"}
                  />
                );
              })}

              {/* Inline input for blank */}
              {showBlank && (
                <span className="inline-block px-1">
                  <input
                    type="text"
                    value={answers[currentBlankIndex] ?? ""}
                    onChange={(e) =>
                      updateAnswer(currentBlankIndex, e.target.value)
                    }
                    disabled={submitted}
                    className={`inline-block w-32 rounded-lg border-b-2 bg-transparent px-2 py-1 text-center font-mono text-base
                      focus:outline-none focus:ring-0
                      ${
                        submitted
                          ? correctAnswers?.[currentBlankIndex]?.toLowerCase() ===
                            answers[currentBlankIndex]?.toLowerCase()
                            ? "border-success-500 text-success-700 dark:text-success-400"
                            : "border-danger-500 text-danger-700 dark:text-danger-400"
                          : "border-warm-300 text-warm-900 focus:border-primary-500 dark:border-warm-600 dark:text-warm-100 dark:focus:border-primary-400"
                      }`}
                    placeholder="..."
                    aria-label={`Blank ${currentBlankIndex + 1}`}
                  />
                </span>
              )}
            </span>
          );
        })}
      </div>

      {/* Correct answers display after submit */}
      {submitted && correctAnswers && (
        <div className="rounded-xl bg-warm-100 px-4 py-3 text-sm dark:bg-warm-800">
          <span className="font-medium text-warm-600 dark:text-warm-400">
            Correct answer{correctAnswers.length > 1 ? "s" : ""}:{" "}
          </span>
          {correctAnswers.map((a, i) => (
            <span key={i}>
              {i > 0 && ", "}
              <span className="font-mono font-semibold text-success-600 dark:text-success-400">
                {a}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Submit */}
      {!submitted && (
        <button
          onClick={() => onSubmit(answers)}
          disabled={!allFilled}
          className="btn-primary"
        >
          Check Answer
        </button>
      )}
    </div>
  );
}
