import { useState } from "react";
import type { Question } from "@/types/quiz";
import { RichText } from "@/components/lesson/LessonContent";

interface FreeResponseProps {
  question: Question;
  onSubmit: (text: string) => void;
  submitted: boolean;
  className?: string;
}

export function FreeResponse({
  question,
  onSubmit,
  submitted,
  className = "",
}: FreeResponseProps) {
  const [text, setText] = useState("");

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Question prompt */}
      <div className="text-lg font-medium text-warm-900 dark:text-warm-100">
        <RichText text={question.prompt} />
      </div>

      {/* Text area */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={submitted}
        placeholder="Type your answer here..."
        rows={6}
        className="input resize-y font-mono text-sm"
      />

      {/* Hint */}
      {question.hint && !submitted && (
        <p className="text-xs text-warm-400 dark:text-warm-500">
          Hint: <RichText text={question.hint} />
        </p>
      )}

      {/* Submit */}
      {!submitted && (
        <button
          onClick={() => {
            if (text.trim()) onSubmit(text.trim());
          }}
          disabled={!text.trim()}
          className="btn-primary"
        >
          Submit Answer
        </button>
      )}
    </div>
  );
}
