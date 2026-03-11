import { Fragment } from "react";
import type { LessonContent as LessonContentType } from "@/types/lesson";
import { parseLatexSegments } from "@/lib/katex-utils";
import { AccessibleMath } from "@/components/shared/AccessibleMath";
import { WorkedExample } from "@/components/lesson/WorkedExample";

interface LessonContentProps {
  lesson: LessonContentType;
  className?: string;
}

/**
 * Renders a paragraph of text that may contain inline and display LaTeX.
 */
function RichText({ text }: { text: string }) {
  const segments = parseLatexSegments(text);

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === "text") {
          // Split on newlines and render paragraphs
          const parts = seg.content.split("\n\n");
          return (
            <Fragment key={i}>
              {parts.map((part, j) => {
                if (j > 0) return <Fragment key={j}><br /><br />{part}</Fragment>;
                return <Fragment key={j}>{part}</Fragment>;
              })}
            </Fragment>
          );
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
