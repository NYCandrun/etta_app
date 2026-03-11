import { useState, useEffect } from "react";
import type { Submission } from "@/types/submission";
import * as ipc from "@/lib/ipc";
import { formatRelativeDate } from "@/lib/format";
import { SkeletonLoader } from "@/components/shared/SkeletonLoader";

interface ScienceJournalProps {
  className?: string;
}

export function ScienceJournal({ className = "" }: ScienceJournalProps) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const subs = await ipc.getSubmissions();
        if (!cancelled) setSubmissions(subs);
      } catch {
        // empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className={`card ${className}`}>
        <h3 className="mb-4 text-sm font-medium text-warm-500 dark:text-warm-400">
          Science Journal
        </h3>
        <SkeletonLoader lines={4} showMessage={false} />
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className={`card ${className}`}>
        <h3 className="mb-4 text-sm font-medium text-warm-500 dark:text-warm-400">
          Science Journal
        </h3>
        <p className="py-4 text-center text-sm text-warm-400 dark:text-warm-500">
          Your submitted projects will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className={`card ${className}`}>
      <h3 className="mb-4 text-sm font-medium text-warm-500 dark:text-warm-400">
        Science Journal
      </h3>

      <div className="space-y-3">
        {submissions.map((sub) => (
          <div
            key={sub.id}
            className="flex items-start gap-3 rounded-xl border border-warm-200 p-3 dark:border-warm-700"
          >
            {/* Status indicator */}
            <div
              className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                sub.feedback?.verdict === "pass"
                  ? "bg-success-100 dark:bg-success-900"
                  : sub.status === "reviewed"
                    ? "bg-accent-100 dark:bg-accent-900"
                    : "bg-warm-100 dark:bg-warm-800"
              }`}
            >
              {sub.feedback?.verdict === "pass" ? (
                <svg className="h-4 w-4 text-success-600 dark:text-success-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : sub.status === "reviewed" ? (
                <svg className="h-4 w-4 text-accent-600 dark:text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                </svg>
              ) : (
                <svg className="h-4 w-4 text-warm-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-warm-800 dark:text-warm-200">
                {sub.fileName}
              </p>
              <p className="text-xs text-warm-400 dark:text-warm-500">
                {formatRelativeDate(sub.submittedAt)} — {sub.status}
              </p>
              {sub.feedback && (
                <p className="mt-1 text-xs text-warm-500 dark:text-warm-400">
                  Score: {Math.round(sub.feedback.overallScore * 100)}%
                  {sub.feedback.strengths[0] && ` — ${sub.feedback.strengths[0]}`}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
