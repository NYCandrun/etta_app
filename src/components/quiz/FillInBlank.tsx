import { useState, useRef, useCallback } from "react";
import type { Question } from "@/types/quiz";
import { parseLatexSegments } from "@/lib/katex-utils";
import { AccessibleMath } from "@/components/shared/AccessibleMath";
import { MathKeyboard } from "@/components/quiz/MathKeyboard";

interface FillInBlankProps {
  question: Question;
  onSubmit: (blanks: string[]) => void;
  submitted: boolean;
  correctAnswers?: string[];
  className?: string;
}

/**
 * Renders a sentence with embedded input fields for blanks.
 * Simple blanks get small inline inputs; complex blanks get larger text areas.
 * Also supports optional file upload for work-showing.
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
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [focusedBlank, setFocusedBlank] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determine if this is a "complex" fill-in-blank (long expected answers or multi-step)
  const isComplex =
    (question.blanks?.some((b) => b.length > 20) ?? false) ||
    blankCount > 3 ||
    question.difficulty >= 4;

  const handleInsertSymbol = useCallback(
    (symbol: string) => {
      updateAnswer(focusedBlank, (answers[focusedBlank] ?? "") + symbol);
    },
    [focusedBlank, answers]
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setUploadedFile(file);
  };

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

              {/* Inline input for blank — sized to expected answer */}
              {showBlank && !isComplex && (
                <span className="inline-block px-1">
                  <input
                    type="text"
                    value={answers[currentBlankIndex] ?? ""}
                    onFocus={() => setFocusedBlank(currentBlankIndex)}
                    onChange={(e) =>
                      updateAnswer(currentBlankIndex, e.target.value)
                    }
                    disabled={submitted}
                    style={{
                      width: `${Math.max(
                        4,
                        (correctAnswers?.[currentBlankIndex]?.length ?? 8) + 2
                      )}ch`,
                    }}
                    className={`inline-block rounded-lg border-b-2 bg-transparent px-2 py-1 text-center font-mono text-base
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

      {/* Complex blanks: show larger text areas below the prompt */}
      {isComplex && (
        <div className="space-y-3">
          {Array.from({ length: blankCount }, (_, i) => (
            <div key={i}>
              <label className="mb-1 block text-xs font-medium text-warm-500 dark:text-warm-400">
                Answer {blankCount > 1 ? i + 1 : ""}
              </label>
              <textarea
                value={answers[i] ?? ""}
                onChange={(e) => updateAnswer(i, e.target.value)}
                disabled={submitted}
                rows={Math.min(6, Math.max(2, Math.ceil((correctAnswers?.[i]?.length ?? 20) / 40)))}
                className={`input w-full resize-y font-mono text-sm ${
                  submitted
                    ? correctAnswers?.[i]?.toLowerCase() ===
                      answers[i]?.toLowerCase()
                      ? "border-success-500"
                      : "border-danger-500"
                    : ""
                }`}
                placeholder="Type your answer..."
                aria-label={`Answer ${i + 1}`}
              />
            </div>
          ))}
        </div>
      )}

      {/* File upload for showing work */}
      {question.difficulty >= 3 && (
        <div className="rounded-xl border border-dashed border-warm-300 p-4 dark:border-warm-600">
          <p className="mb-2 text-xs font-medium text-warm-500 dark:text-warm-400">
            Show your work (optional)
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={submitted}
              className="btn-secondary text-xs"
            >
              {uploadedFile ? "Change file" : "Upload image or file"}
            </button>
            {uploadedFile && (
              <span className="truncate text-xs text-warm-600 dark:text-warm-400">
                {uploadedFile.name}
              </span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.txt"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>
      )}

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

      {/* Math symbol keyboard */}
      {!submitted && (
        <MathKeyboard
          onInsert={handleInsertSymbol}
          disabled={submitted}
        />
      )}
    </div>
  );
}
