import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import type { Concept, CurriculumState } from "@/types/concept";
import { useSession } from "@/hooks/useSession";
import * as ipc from "@/lib/ipc";

/** A diagnostic question to determine placement. */
interface DiagnosticQuestion {
  id: string;
  domain: string;
  domainName: string;
  conceptId: string;
  conceptName: string;
  prompt: string;
  options: { id: string; text: string; isCorrect: boolean }[];
  difficulty: number; // 1–5
}

/** Build diagnostic questions from curriculum concepts. */
function buildDiagnosticQuestions(curriculum: CurriculumState): DiagnosticQuestion[] {
  const questions: DiagnosticQuestion[] = [];

  // Group concepts by domain
  const domainConcepts = new Map<string, Concept[]>();
  for (const c of curriculum.concepts) {
    const arr = domainConcepts.get(c.domain.id) ?? [];
    arr.push(c);
    domainConcepts.set(c.domain.id, arr);
  }

  // For each domain, pick diagnostic probe concepts (early, mid, late)
  for (const [domainId, concepts] of domainConcepts) {
    const domainName = concepts[0]?.domain.name ?? domainId;
    const probeIndices = [
      0, // earliest
      Math.floor(concepts.length * 0.3),
      Math.floor(concepts.length * 0.6),
      Math.min(concepts.length - 1, Math.floor(concepts.length * 0.9)),
    ];

    // Deduplicate indices
    const seen = new Set<number>();
    for (const idx of probeIndices) {
      if (seen.has(idx)) continue;
      seen.add(idx);
      const concept = concepts[idx];
      if (!concept) continue;

      questions.push(generateQuestionForConcept(concept, domainName, idx / concepts.length));
    }
  }

  return questions;
}

/** Generate a multiple-choice diagnostic question for a concept. */
function generateQuestionForConcept(
  concept: Concept,
  domainName: string,
  positionRatio: number
): DiagnosticQuestion {
  const difficulty = Math.ceil(positionRatio * 4) + 1;

  // Generate a diagnostic question based on the concept name
  const options = [
    { id: "a", text: `I can explain ${concept.name} confidently`, isCorrect: true },
    { id: "b", text: `I've seen ${concept.name} before but I'm not confident`, isCorrect: false },
    { id: "c", text: `I've heard of ${concept.name} but don't understand it`, isCorrect: false },
    { id: "d", text: `I've never learned ${concept.name}`, isCorrect: false },
  ];

  return {
    id: `diag_${concept.id}`,
    domain: concept.domain.id,
    domainName,
    conceptId: concept.id,
    conceptName: concept.name,
    prompt: `How familiar are you with "${concept.name}"?`,
    options,
    difficulty,
  };
}

/** Score the diagnostic results per domain. Returns domain -> familiarity 0–1 */
function scoreDiagnostic(
  questions: DiagnosticQuestion[],
  answers: Map<string, string>
): Map<string, { score: number; startIndex: number }> {
  const domainScores = new Map<string, { total: number; confident: number; firstUnknown: number; count: number }>();

  for (const q of questions) {
    const entry = domainScores.get(q.domain) ?? { total: 0, confident: 0, firstUnknown: questions.length, count: 0 };
    entry.total++;
    const answer = answers.get(q.id);
    if (answer === "a") {
      entry.confident++;
    } else if (entry.firstUnknown === questions.length) {
      entry.firstUnknown = entry.count;
    }
    entry.count++;
    domainScores.set(q.domain, entry);
  }

  const result = new Map<string, { score: number; startIndex: number }>();
  for (const [domain, data] of domainScores) {
    result.set(domain, {
      score: data.total > 0 ? data.confident / data.total : 0,
      startIndex: data.firstUnknown,
    });
  }
  return result;
}

export default function Diagnostic() {
  const navigate = useNavigate();
  const { startLearningPath } = useSession();
  const [curriculum, setCurriculum] = useState<CurriculumState | null>(null);
  const [questions, setQuestions] = useState<DiagnosticQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, string>>(new Map());
  const [phase, setPhase] = useState<"loading" | "intro" | "testing" | "results">("loading");
  const [results, setResults] = useState<Map<string, { score: number; startIndex: number }> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const state = await ipc.getCurriculumState();
        if (state) {
          setCurriculum(state);
          const qs = buildDiagnosticQuestions(state);
          setQuestions(qs);
        }
      } catch {
        // empty
      } finally {
        setPhase("intro");
      }
    })();
  }, []);

  const handleAnswer = useCallback(
    (optionId: string) => {
      const q = questions[currentIndex];
      if (!q) return;

      // Build updated answers synchronously to avoid stale closure in setTimeout
      const updatedAnswers = new Map(answers);
      updatedAnswers.set(q.id, optionId);
      setAnswers(updatedAnswers);

      // Capture values needed by the timeout so it doesn't rely on stale state
      const isLast = currentIndex >= questions.length - 1;
      const nextIndex = currentIndex + 1;

      // Auto-advance after a brief delay
      setTimeout(() => {
        if (!isLast) {
          setCurrentIndex(nextIndex);
        } else {
          // Score using the pre-computed updatedAnswers (not stale `answers`)
          const scored = scoreDiagnostic(questions, updatedAnswers);
          setResults(scored);
          setPhase("results");
        }
      }, 300);
    },
    [currentIndex, questions, answers]
  );

  const handleEnroll = useCallback(
    (domainId: string) => {
      if (!curriculum) return;
      const domainConcepts = curriculum.concepts.filter(
        (c) => c.domain.id === domainId
      );
      if (domainConcepts.length > 0) {
        startLearningPath(domainConcepts);
        navigate("/lesson");
      }
    },
    [curriculum, startLearningPath, navigate]
  );

  const handleAutoEnroll = useCallback(() => {
    if (!curriculum || !results) return;

    // Find the domain with the lowest score (most need) that has concepts
    let bestDomain = "";
    let lowestScore = 2;
    for (const [domain, data] of results) {
      if (data.score < lowestScore) {
        lowestScore = data.score;
        bestDomain = domain;
      }
    }

    // Default to algebra if nothing else
    const targetDomain = bestDomain || "algebra";
    handleEnroll(targetDomain);
  }, [curriculum, results, handleEnroll]);

  if (phase === "loading") {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  if (phase === "intro") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mx-auto max-w-lg py-12 text-center"
      >
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary-100 dark:bg-primary-900">
          <svg className="h-10 w-10 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
          </svg>
        </div>

        <h1 className="mb-3 text-2xl font-bold text-warm-900 dark:text-warm-100">
          Diagnostic Assessment
        </h1>
        <p className="mb-2 text-warm-600 dark:text-warm-400">
          Answer a series of questions to help us figure out where you are in your learning journey.
          No prior knowledge is assumed — this starts from the very beginning.
        </p>
        {questions.length > 0 ? (
          <>
            <p className="mb-8 text-sm text-warm-400 dark:text-warm-500">
              {questions.length} questions across {curriculum?.domains.length ?? 0} subjects.
              Takes about {Math.ceil(questions.length * 0.25)} minutes.
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => setPhase("testing")}
                className="btn-primary w-full"
              >
                Start Diagnostic
              </button>
              <button
                onClick={() => navigate("/")}
                className="btn-secondary w-full"
              >
                Skip — I'll pick my own path
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-6 rounded-xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-700 dark:border-accent-800 dark:bg-accent-950/30 dark:text-accent-300">
              No curriculum data is available yet. Please check your connection or try again later.
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setPhase("loading");
                  (async () => {
                    try {
                      const state = await ipc.getCurriculumState();
                      if (state) {
                        setCurriculum(state);
                        const qs = buildDiagnosticQuestions(state);
                        setQuestions(qs);
                      }
                    } catch {
                      // empty
                    } finally {
                      setPhase("intro");
                    }
                  })();
                }}
                className="btn-primary w-full"
              >
                Retry
              </button>
              <button
                onClick={() => navigate("/")}
                className="btn-secondary w-full"
              >
                Back to Dashboard
              </button>
            </div>
          </>
        )}
      </motion.div>
    );
  }

  if (phase === "results" && results) {
    const domainResults = [...results.entries()].map(([domainId, data]) => {
      const domainConcepts = curriculum?.concepts.filter(
        (c) => c.domain.id === domainId
      ) ?? [];
      const domainName = domainConcepts[0]?.domain.name ?? domainId;
      const color = domainConcepts[0]?.domain.color ?? "#6b7280";
      return { domainId, domainName, color, ...data, conceptCount: domainConcepts.length };
    });

    // Sort: lowest score first (most need for learning)
    domainResults.sort((a, b) => a.score - b.score);

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mx-auto max-w-2xl space-y-6 py-8"
      >
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold text-warm-900 dark:text-warm-100">
            Your Results
          </h1>
          <p className="text-warm-500 dark:text-warm-400">
            Based on your answers, here's where we recommend you start.
          </p>
        </div>

        <div className="space-y-3">
          {domainResults.map((d) => (
            <div
              key={d.domainId}
              className="card flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: d.color }}
                />
                <div>
                  <p className="font-medium text-warm-900 dark:text-warm-100">
                    {d.domainName}
                  </p>
                  <p className="text-xs text-warm-400">
                    {d.conceptCount} concepts — Familiarity: {Math.round(d.score * 100)}%
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleEnroll(d.domainId)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                  d.score < 0.5
                    ? "bg-primary-600 text-white hover:bg-primary-700"
                    : "bg-warm-100 text-warm-700 hover:bg-warm-200 dark:bg-warm-800 dark:text-warm-300 dark:hover:bg-warm-700"
                }`}
              >
                {d.score < 0.5 ? "Start here" : "Review"}
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-3 pt-4">
          <button
            onClick={handleAutoEnroll}
            className="btn-primary flex-1"
          >
            Auto-enroll in recommended path
          </button>
          <button
            onClick={() => navigate("/")}
            className="btn-secondary flex-1"
          >
            Choose from Dashboard
          </button>
        </div>
      </motion.div>
    );
  }

  // Testing phase
  const currentQ = questions[currentIndex];
  if (!currentQ) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="mb-4 text-warm-500 dark:text-warm-400">
          No diagnostic questions available. Try loading the curriculum first.
        </p>
        <button onClick={() => navigate("/")} className="btn-secondary">
          Go to Dashboard
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mx-auto max-w-2xl space-y-6 py-8"
    >
      {/* Progress */}
      <div>
        <div className="flex items-center justify-between text-xs text-warm-400 dark:text-warm-500">
          <span>
            Question {currentIndex + 1} of {questions.length}
          </span>
          <span className="rounded-md px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: `${curriculum?.concepts.find(c => c.domain.id === currentQ.domain)?.domain.color ?? "#6b7280"}20`, color: curriculum?.concepts.find(c => c.domain.id === currentQ.domain)?.domain.color ?? "#6b7280" }}>
            {currentQ.domainName}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-warm-200 dark:bg-warm-800">
          <motion.div
            className="h-full rounded-full bg-primary-500"
            animate={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQ.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="card space-y-4"
        >
          <p className="text-xs font-medium text-warm-400 dark:text-warm-500">
            {currentQ.conceptName}
          </p>
          <h2 className="text-lg font-semibold text-warm-900 dark:text-warm-100">
            {currentQ.prompt}
          </h2>

          <div className="space-y-2">
            {currentQ.options.map((opt) => {
              const selected = answers.get(currentQ.id) === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => handleAnswer(opt.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all
                    ${
                      selected
                        ? "border-primary-400 bg-primary-50 ring-2 ring-primary-200 dark:border-primary-500 dark:bg-primary-950 dark:ring-primary-800"
                        : "border-warm-200 bg-white hover:border-warm-300 hover:bg-warm-50 dark:border-warm-700 dark:bg-warm-850 dark:hover:border-warm-600 dark:hover:bg-warm-800"
                    }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold
                      ${
                        selected
                          ? "border-primary-500 bg-primary-500 text-white"
                          : "border-warm-300 text-warm-500 dark:border-warm-600 dark:text-warm-400"
                      }`}
                  >
                    {opt.id.toUpperCase()}
                  </span>
                  <span className="text-warm-700 dark:text-warm-300">
                    {opt.text}
                  </span>
                </button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
