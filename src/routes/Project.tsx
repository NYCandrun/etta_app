import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { ProjectPrompt } from "@/components/project/ProjectPrompt";
import { FileUpload } from "@/components/project/FileUpload";
import { SubmissionStatus } from "@/components/project/SubmissionStatus";
import { FeedbackDisplay } from "@/components/project/FeedbackDisplay";
import { SkeletonLoader } from "@/components/shared/SkeletonLoader";
import { useGamification } from "@/hooks/useGamification";
import type { ProjectDefinition, Submission } from "@/types/submission";
import * as ipc from "@/lib/ipc";

export default function Project() {
  const [projects, setProjects] = useState<ProjectDefinition[]>([]);
  const [selectedProject, setSelectedProject] =
    useState<ProjectDefinition | null>(null);
  const [currentSubmission, setCurrentSubmission] =
    useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { awardXP } = useGamification();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await ipc.getProjects();
        if (!cancelled) {
          setProjects(p);
          if (p.length > 0) setSelectedProject(p[0] ?? null);
        }
      } catch {
        if (!cancelled) setError("Failed to load projects. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Poll for submission feedback when evaluating
  useEffect(() => {
    if (currentSubmission?.status !== "evaluating") return;
    const interval = setInterval(async () => {
      try {
        const feedback = await ipc.getSubmissionFeedback(currentSubmission.id);
        if (feedback) {
          setCurrentSubmission((prev) =>
            prev ? { ...prev, status: "reviewed", feedback } : prev
          );
          if (feedback.xpEarned > 0) {
            await awardXP(
              feedback.xpEarned,
              "project_pass",
              "Project evaluated"
            );
          }
        }
      } catch {
        // keep polling
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [currentSubmission, awardXP]);

  const handleFileSelected = useCallback(
    async (filePath: string, _fileName: string) => {
      if (!selectedProject) return;
      setSubmitting(true);
      try {
        const submission = await ipc.submitProject(
          selectedProject.id,
          filePath
        );
        setCurrentSubmission(submission);
      } catch {
        setError("Failed to submit project. Please try again.");
        setCurrentSubmission(null);
      } finally {
        setSubmitting(false);
      }
    },
    [selectedProject]
  );

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mx-auto max-w-3xl space-y-6"
      >
        <SkeletonLoader lines={8} />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="mx-auto max-w-3xl space-y-6"
    >
      {/* Error state */}
      {error && (
        <div className="card border border-danger-200 bg-danger-50 dark:border-danger-800 dark:bg-danger-950/30">
          <div className="flex items-center justify-between">
            <p className="text-sm text-danger-700 dark:text-danger-300">{error}</p>
            <button
              onClick={() => setError(null)}
              className="rounded-lg bg-danger-100 px-3 py-1.5 text-xs font-medium text-danger-700 transition-colors hover:bg-danger-200 dark:bg-danger-900 dark:text-danger-300 dark:hover:bg-danger-800"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Project selector */}
      {projects.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setSelectedProject(p);
                setCurrentSubmission(null);
              }}
              className={`shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition-smooth ${
                selectedProject?.id === p.id
                  ? "bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300"
                  : "bg-warm-100 text-warm-600 hover:bg-warm-200 dark:bg-warm-800 dark:text-warm-400 dark:hover:bg-warm-700"
              }`}
            >
              {p.title}
            </button>
          ))}
        </div>
      )}

      {projects.length === 0 ? (
        <div className="card py-16 text-center">
          <svg
            className="mx-auto mb-4 h-16 w-16 text-warm-300 dark:text-warm-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"
            />
          </svg>
          <h2 className="text-xl font-semibold text-warm-700 dark:text-warm-300">
            No projects available yet
          </h2>
          <p className="mt-2 text-warm-400 dark:text-warm-500">
            Complete more lessons to unlock hands-on projects.
          </p>
        </div>
      ) : selectedProject ? (
        <>
          <ProjectPrompt project={selectedProject} />

          {/* Upload section */}
          {!currentSubmission && (
            <FileUpload
              acceptedFormats={selectedProject.acceptedFormats}
              onFileSelected={(path, name) =>
                void handleFileSelected(path, name)
              }
              disabled={submitting}
            />
          )}

          {/* Submission status */}
          {currentSubmission && (
            <SubmissionStatus status={currentSubmission.status} />
          )}

          {/* Feedback */}
          {currentSubmission?.feedback && (
            <FeedbackDisplay feedback={currentSubmission.feedback} />
          )}
        </>
      ) : null}
    </motion.div>
  );
}
