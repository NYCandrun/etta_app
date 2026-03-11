import { useState, useRef, useCallback } from "react";
import type { Question } from "@/types/quiz";
import { RichText } from "@/components/lesson/LessonContent";
import { MathKeyboard } from "@/components/quiz/MathKeyboard";

interface FreeResponseProps {
  question: Question;
  onSubmit: (text: string, files?: File[]) => void;
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
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scale the text area based on question complexity
  const isSimple = question.difficulty <= 2;
  const rows = isSimple ? 3 : question.difficulty >= 4 ? 8 : 6;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setUploadedFiles((prev) => [...prev, ...Array.from(files)]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleInsertSymbol = useCallback((symbol: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setText((prev) => prev + symbol);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = text.slice(0, start);
    const after = text.slice(end);
    const newText = before + symbol + after;
    setText(newText);

    // Restore cursor position after the inserted symbol
    requestAnimationFrame(() => {
      textarea.focus();
      const newPos = start + symbol.length;
      textarea.setSelectionRange(newPos, newPos);
    });
  }, [text]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Question prompt */}
      <div className="text-lg font-medium text-warm-900 dark:text-warm-100">
        <RichText text={question.prompt} />
      </div>

      {/* Text area — sized to question complexity */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={submitted}
        placeholder={
          isSimple
            ? "Type your answer (e.g. 'the answer is the square root of two')..."
            : "Show your reasoning step by step. You can type plain text or use the math keyboard below..."
        }
        rows={rows}
        className={`input w-full resize-y text-sm ${isSimple ? "" : "font-mono"}`}
      />

      {/* File upload section */}
      <div className="rounded-xl border border-dashed border-warm-300 p-4 dark:border-warm-600">
        <p className="mb-2 text-xs font-medium text-warm-500 dark:text-warm-400">
          {isSimple
            ? "Attach a file (optional)"
            : "Upload your work — photo of handwritten solution, diagram, or file"}
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={submitted}
            className="btn-secondary text-xs"
          >
            <svg
              className="mr-1.5 inline h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
            {uploadedFiles.length > 0 ? "Add more files" : "Upload file"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.md,.txt"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
        {uploadedFiles.length > 0 && (
          <div className="mt-2 space-y-2">
            {uploadedFiles.map((file, i) => (
              <div key={`${file.name}-${i}`} className="flex items-center gap-2">
                <span className="max-w-[200px] truncate text-xs text-warm-600 dark:text-warm-400">
                  {file.name}
                </span>
                {!submitted && (
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(i)}
                    className="text-warm-400 hover:text-danger-500"
                    aria-label={`Remove ${file.name}`}
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
                {file.type.startsWith("image/") && (
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`Preview: ${file.name}`}
                    className="ml-2 max-h-24 rounded-lg border border-warm-200 dark:border-warm-700"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

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
            if (text.trim() || uploadedFiles.length > 0) onSubmit(text.trim(), uploadedFiles.length > 0 ? uploadedFiles : undefined);
          }}
          disabled={!text.trim() && uploadedFiles.length === 0}
          className="btn-primary"
        >
          Submit Answer
        </button>
      )}

      {/* Math symbol keyboard — below submit button */}
      {!submitted && (
        <MathKeyboard
          onInsert={handleInsertSymbol}
          disabled={submitted}
        />
      )}
    </div>
  );
}
