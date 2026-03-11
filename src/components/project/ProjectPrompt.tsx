import type { ProjectDefinition } from "@/types/submission";
import { RichText } from "@/components/lesson/LessonContent";
import { formatDuration } from "@/lib/format";

interface ProjectPromptProps {
  project: ProjectDefinition;
  className?: string;
}

export function ProjectPrompt({ project, className = "" }: ProjectPromptProps) {
  return (
    <div className={`card space-y-4 ${className}`}>
      <div className="flex items-start justify-between">
        <h2 className="text-xl font-bold text-warm-900 dark:text-warm-100">
          {project.title}
        </h2>
        <span className="rounded-lg bg-warm-100 px-2 py-0.5 text-xs font-medium text-warm-600 dark:bg-warm-800 dark:text-warm-400">
          ~{formatDuration(project.estimatedMinutes)}
        </span>
      </div>

      <div className="text-sm leading-relaxed text-warm-700 dark:text-warm-300">
        <RichText text={project.description} />
      </div>

      {/* Requirements */}
      <div>
        <h4 className="mb-2 text-sm font-semibold text-warm-800 dark:text-warm-200">
          Requirements
        </h4>
        <ul className="space-y-1.5">
          {project.requirements.map((req, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-warm-600 dark:text-warm-400">
              <svg
                className="mt-0.5 h-4 w-4 shrink-0 text-primary-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {req}
            </li>
          ))}
        </ul>
      </div>

      {/* Accepted formats */}
      <div className="flex flex-wrap gap-2">
        {project.acceptedFormats.map((fmt) => (
          <span
            key={fmt}
            className="rounded-lg bg-warm-100 px-2 py-0.5 text-xs font-mono text-warm-500 dark:bg-warm-800 dark:text-warm-400"
          >
            .{fmt}
          </span>
        ))}
      </div>
    </div>
  );
}
