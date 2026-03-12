import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import type { Concept, CurriculumState } from "@/types/concept";
import { useSession } from "@/hooks/useSession";
import * as ipc from "@/lib/ipc";

export default function LearningPath() {
  const navigate = useNavigate();
  const { domainId } = useParams<{ domainId: string }>();
  const { selectConcept, startLearningPath } = useSession();
  const [curriculum, setCurriculum] = useState<CurriculumState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const state = await ipc.getCurriculumState();
        if (state) setCurriculum(state);
      } catch {
        // empty
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const domainConcepts = curriculum?.concepts.filter(
    (c) => c.domain.id === domainId
  ) ?? [];

  const domain = domainConcepts[0]?.domain;

  // Group by module
  const moduleMap = new Map<string, Concept[]>();
  for (const c of domainConcepts) {
    const arr = moduleMap.get(c.moduleId) ?? [];
    arr.push(c);
    moduleMap.set(c.moduleId, arr);
  }
  const moduleEntries = [...moduleMap.entries()];

  const progress =
    domainConcepts.length > 0
      ? domainConcepts.filter((c) => c.state === "mastered").length /
        domainConcepts.length
      : 0;

  // Find current position (first non-mastered concept)
  const currentConcept = domainConcepts.find(
    (c) => c.state === "in_progress" || c.state === "unlocked"
  );

  const canAccess = (concept: Concept) =>
    concept.state === "mastered" ||
    concept.state === "in_progress" ||
    concept.state === "unlocked";

  const handleConceptClick = (concept: Concept) => {
    if (!canAccess(concept)) return;
    selectConcept(concept);
    navigate("/lesson");
  };

  const handleStartPath = () => {
    startLearningPath(domainConcepts);
    navigate("/lesson");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  if (!domain) {
    return (
      <div className="py-20 text-center">
        <p className="text-warm-400">Learning path not found.</p>
        <button onClick={() => navigate("/")} className="btn-primary mt-4">
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mx-auto max-w-3xl space-y-6"
    >
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
        <button
          onClick={() => navigate("/")}
          className="text-warm-400 transition-colors hover:text-warm-600 dark:text-warm-500 dark:hover:text-warm-300"
        >
          Dashboard
        </button>
        <svg className="h-3.5 w-3.5 text-warm-300 dark:text-warm-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        <span className="font-medium text-warm-900 dark:text-warm-100">
          {domain.name}
        </span>
        {currentConcept && (
          <>
            <svg className="h-3.5 w-3.5 text-warm-300 dark:text-warm-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
            <span className="text-warm-400 dark:text-warm-500">
              {currentConcept.name}
            </span>
          </>
        )}
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: domain.color }}
            />
            <h1 className="text-2xl font-bold text-warm-900 dark:text-warm-100">
              {domain.name}
            </h1>
          </div>
          <p className="text-sm text-warm-400 dark:text-warm-500">
            {domainConcepts.length} concepts — {Math.round(progress * 100)}% complete
          </p>
        </div>

        <button onClick={handleStartPath} className="btn-primary">
          {currentConcept ? "Continue Learning" : "Start Path"}
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-2 overflow-hidden rounded-full bg-warm-200 dark:bg-warm-800">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: domain.color }}
          initial={{ width: 0 }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.8 }}
        />
      </div>

      {/* Module list */}
      <div className="space-y-6">
        {moduleEntries.map(([moduleId, concepts], moduleIndex) => {
          const moduleName = curriculum?.modules.find(
            (m) => m.id === moduleId
          )?.name ?? moduleId.split("_").slice(-1).join(" ");

          return (
            <div key={moduleId}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-warm-500 dark:text-warm-400">
                Module {moduleIndex + 1}: {moduleName}
              </h2>
              <div className="space-y-1">
                {concepts.map((concept, conceptIndex) => {
                  const accessible = canAccess(concept);
                  const isCurrent = concept.id === currentConcept?.id;

                  return (
                    <button
                      key={concept.id}
                      onClick={() => handleConceptClick(concept)}
                      disabled={!accessible}
                      className={`flex w-full items-center gap-4 rounded-xl px-4 py-3 text-left transition-all
                        ${
                          isCurrent
                            ? "bg-primary-50 ring-2 ring-primary-200 dark:bg-primary-950 dark:ring-primary-800"
                            : accessible
                              ? "hover:bg-warm-50 dark:hover:bg-warm-800"
                              : "cursor-not-allowed opacity-50"
                        }`}
                    >
                      {/* Status indicator */}
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                        {concept.state === "mastered" ? (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success-100 dark:bg-success-900">
                            <svg className="h-4 w-4 text-success-600 dark:text-success-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          </div>
                        ) : concept.state === "in_progress" ? (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-100 dark:bg-accent-900">
                            <div className="h-3 w-3 rounded-full bg-accent-500" />
                          </div>
                        ) : concept.state === "unlocked" ? (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary-300 dark:border-primary-600">
                            <span className="text-xs font-bold text-primary-600 dark:text-primary-400">
                              {conceptIndex + 1}
                            </span>
                          </div>
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-warm-200 dark:bg-warm-700">
                            <svg className="h-4 w-4 text-warm-400 dark:text-warm-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Concept info */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${
                          accessible
                            ? "text-warm-900 dark:text-warm-100"
                            : "text-warm-400 dark:text-warm-600"
                        }`}>
                          {concept.name}
                        </p>
                        <p className="truncate text-xs text-warm-400 dark:text-warm-500">
                          {concept.description}
                        </p>
                      </div>

                      {/* Mastery score */}
                      {concept.state !== "locked" && concept.masteryScore > 0 && (
                        <div className="shrink-0">
                          <span className={`text-xs font-semibold ${
                            concept.masteryScore >= 0.8
                              ? "text-success-600 dark:text-success-400"
                              : "text-warm-500 dark:text-warm-400"
                          }`}>
                            {Math.round(concept.masteryScore * 100)}%
                          </span>
                        </div>
                      )}

                      {/* Arrow for accessible */}
                      {accessible && (
                        <svg className="h-4 w-4 shrink-0 text-warm-300 dark:text-warm-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
