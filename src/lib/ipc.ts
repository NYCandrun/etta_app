import { tauriInvoke, isTauri } from "@/hooks/useInvoke";
import type { CurriculumState, Concept, ConceptState } from "@/types/concept";
import type { LessonContent, ExplanationResponse } from "@/types/lesson";
import type { QuizSession, Answer, Feedback } from "@/types/quiz";
import type {
  ProjectDefinition,
  Submission,
  FeedbackResult,
} from "@/types/submission";
import type { GamificationState, XPSource } from "@/types/gamification";

// ─── Settings ──────────────────────────────────────────────

export async function getSetting<T>(key: string): Promise<T | null> {
  if (!isTauri()) return null;
  return tauriInvoke<T>("get_setting", { key });
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  if (!isTauri()) return;
  return tauriInvoke<void>("set_setting", { key, value });
}

// ─── API Key ───────────────────────────────────────────────

export async function storeApiKey(apiKey: string): Promise<void> {
  if (!isTauri()) return;
  return tauriInvoke<void>("store_api_key", { apiKey });
}

export async function testApiKey(): Promise<{ valid: boolean; message: string }> {
  if (!isTauri()) {
    return { valid: false, message: "Tauri not available in browser mode" };
  }
  return tauriInvoke<{ valid: boolean; message: string }>("test_api_key");
}

// ─── Curriculum ────────────────────────────────────────────

/**
 * Normalize a raw concept from the backend into the frontend Concept type.
 * Handles both the new FrontendConcept shape and legacy flat shapes.
 */
function normalizeConcept(raw: Record<string, unknown>): Concept {
  // If domain is a string (legacy), wrap it
  const domain =
    typeof raw.domain === "object" && raw.domain !== null
      ? (raw.domain as Concept["domain"])
      : {
          id: String(raw.domain ?? "unknown"),
          name: String(raw.domain ?? "Unknown"),
          description: "",
          color: "#6b7280",
          iconName: "book",
          moduleIds: [],
        };

  const state: ConceptState = (
    ["locked", "unlocked", "in_progress", "mastered"].includes(
      String(raw.state ?? "")
    )
      ? raw.state
      : raw.masteryScore != null && Number(raw.masteryScore) >= 0.8
        ? "mastered"
        : raw.attemptCount != null && Number(raw.attemptCount) > 0
          ? "in_progress"
          : "unlocked"
  ) as ConceptState;

  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? raw.title ?? ""),
    description: String(raw.description ?? `Learn about ${raw.name ?? raw.title ?? ""}`),
    domain,
    moduleId: String(raw.moduleId ?? raw.module ?? ""),
    state,
    masteryScore: Number(raw.masteryScore ?? raw.mastery_score ?? 0),
    prerequisites: Array.isArray(raw.prerequisites)
      ? (raw.prerequisites as string[])
      : [],
    estimatedMinutes: Number(raw.estimatedMinutes ?? raw.estimated_minutes ?? 10),
    lastReviewedAt: (raw.lastReviewedAt ?? raw.last_correct ?? null) as string | null,
    nextReviewAt: (raw.nextReviewAt ?? raw.next_review ?? null) as string | null,
  };
}

export async function getCurriculumState(): Promise<CurriculumState | null> {
  if (!isTauri()) return null;
  const raw = await tauriInvoke<unknown>("get_curriculum_state");
  if (!raw) return null;

  // If the backend returns the full CurriculumState shape, use it directly
  if (
    typeof raw === "object" &&
    raw !== null &&
    "domains" in raw &&
    "concepts" in raw
  ) {
    const obj = raw as Record<string, unknown>;
    const concepts = (obj.concepts as Record<string, unknown>[]).map(normalizeConcept);
    return {
      domains: obj.domains as CurriculumState["domains"],
      modules: (obj.modules ?? []) as CurriculumState["modules"],
      concepts,
      totalMastery: Number(obj.totalMastery ?? 0),
      conceptsCompleted: Number(obj.conceptsCompleted ?? 0),
      conceptsTotal: Number(obj.conceptsTotal ?? concepts.length),
    };
  }

  // Legacy: backend returns Vec<ConceptState> (flat array)
  if (Array.isArray(raw)) {
    const concepts = (raw as Record<string, unknown>[]).map(normalizeConcept);
    const mastered = concepts.filter((c) => c.state === "mastered").length;
    const totalMastery =
      concepts.length > 0
        ? concepts.reduce((s, c) => s + c.masteryScore, 0) / concepts.length
        : 0;

    // Derive domains from concepts
    const domainMap = new Map<string, typeof concepts>();
    for (const c of concepts) {
      const arr = domainMap.get(c.domain.id) ?? [];
      arr.push(c);
      domainMap.set(c.domain.id, arr);
    }

    return {
      domains: [...domainMap.values()].map((arr) => arr[0]!.domain),
      modules: [],
      concepts,
      totalMastery,
      conceptsCompleted: mastered,
      conceptsTotal: concepts.length,
    };
  }

  return null;
}

// ─── Sessions ──────────────────────────────────────────────

interface DailySessionResponse {
  id: string;
  concepts: Concept[];
  estimatedMinutes: number;
}

export async function getDailySession(): Promise<DailySessionResponse | null> {
  if (!isTauri()) return null;
  const raw = await tauriInvoke<Record<string, unknown>>("get_daily_session");
  if (!raw) return null;

  // Normalize the concepts from the response
  const rawConcepts = (raw.concepts ?? raw.reviews ?? []) as Record<string, unknown>[];
  const concepts = rawConcepts.map(normalizeConcept);

  // If there's a new_concept / newConcept, append it
  const nc = (raw.newConcept ?? raw.new_concept) as Record<string, unknown> | undefined;
  if (nc) {
    concepts.push(normalizeConcept(nc));
  }

  return {
    id: String(raw.id ?? `session_${new Date().toISOString().slice(0, 10)}`),
    concepts,
    estimatedMinutes: Number(raw.estimatedMinutes ?? raw.estimated_minutes ?? concepts.length * 10),
  };
}

// ─── Lessons ───────────────────────────────────────────────

export async function getLesson(conceptId: string): Promise<LessonContent> {
  return tauriInvoke<LessonContent>("get_lesson", { conceptId });
}

export async function requestExplanation(
  conceptId: string,
  lessonId: string,
  attempt: number
): Promise<ExplanationResponse> {
  return tauriInvoke<ExplanationResponse>("request_explanation", {
    conceptId,
    lessonId,
    attempt,
  });
}

// ─── Quiz ──────────────────────────────────────────────────

export async function getQuiz(conceptId: string): Promise<QuizSession> {
  return tauriInvoke<QuizSession>("get_quiz", { conceptId });
}

export async function submitAnswer(
  sessionId: string,
  answer: Answer
): Promise<Feedback> {
  return tauriInvoke<Feedback>("submit_answer", { sessionId, answer });
}

export async function completeQuiz(
  sessionId: string
): Promise<{ totalScore: number; xpEarned: number }> {
  return tauriInvoke<{ totalScore: number; xpEarned: number }>(
    "complete_quiz",
    { sessionId }
  );
}

// ─── Projects ──────────────────────────────────────────────

export async function getProjects(): Promise<ProjectDefinition[]> {
  if (!isTauri()) return [];
  return tauriInvoke<ProjectDefinition[]>("get_projects");
}

export async function submitProject(
  projectId: string,
  filePath: string
): Promise<Submission> {
  return tauriInvoke<Submission>("submit_project", { projectId, filePath });
}

export async function getSubmissions(
  projectId?: string
): Promise<Submission[]> {
  if (!isTauri()) return [];
  return tauriInvoke<Submission[]>("get_submissions", { projectId });
}

export async function getSubmissionFeedback(
  submissionId: string
): Promise<FeedbackResult | null> {
  if (!isTauri()) return null;
  return tauriInvoke<FeedbackResult>("get_submission_feedback", {
    submissionId,
  });
}

// ─── Gamification ──────────────────────────────────────────

export async function getGamificationState(): Promise<GamificationState | null> {
  if (!isTauri()) return null;
  return tauriInvoke<GamificationState>("get_gamification_state");
}

export async function awardXp(
  amount: number,
  source: XPSource,
  description: string
): Promise<void> {
  if (!isTauri()) return;
  return tauriInvoke<void>("award_xp", { amount, source, description });
}

export async function activateStreakFreeze(): Promise<boolean> {
  if (!isTauri()) return false;
  return tauriInvoke<boolean>("activate_streak_freeze");
}

// ─── Progress / History ────────────────────────────────────

export interface MasteryDataPoint {
  date: string;
  domain: string;
  score: number;
}

export async function getMasteryHistory(): Promise<MasteryDataPoint[]> {
  if (!isTauri()) return [];
  return tauriInvoke<MasteryDataPoint[]>("get_mastery_history");
}

export interface ReviewForecastItem {
  conceptId: string;
  conceptName: string;
  dueDate: string;
  domain: string;
}

export async function getReviewForecast(): Promise<ReviewForecastItem[]> {
  if (!isTauri()) return [];
  return tauriInvoke<ReviewForecastItem[]>("get_review_forecast");
}

// ─── Models ───────────────────────────────────────────────

export interface ModelOption {
  id: string;
  displayName: string;
}

export async function listAvailableModels(): Promise<ModelOption[]> {
  if (!isTauri()) return [];
  try {
    return await tauriInvoke<ModelOption[]>("list_available_models");
  } catch {
    return [];
  }
}

// ─── Explanation / Escalation ─────────────────────────────

export async function explainMistake(
  questionPrompt: string,
  userAnswer: string,
  correctAnswer: string,
  context: string,
  escalate: boolean
): Promise<string> {
  if (!isTauri()) {
    return "Explanation is unavailable in browser mode. Please run the app in Tauri.";
  }
  try {
    return await tauriInvoke<string>("explain_mistake", {
      questionPrompt,
      userAnswer,
      correctAnswer,
      context,
      escalate,
    });
  } catch {
    return "Unable to generate explanation right now. Please try again later.";
  }
}

export async function regradeWithReasoning(
  questionPrompt: string,
  userAnswer: string,
  rubric: string,
  fileData?: string,
  fileMimeType?: string
): Promise<{ isCorrect: boolean; score: number; explanation: string }> {
  if (!isTauri()) {
    return { isCorrect: false, score: 0, explanation: "Re-grading unavailable in browser mode." };
  }
  try {
    return await tauriInvoke<{ isCorrect: boolean; score: number; explanation: string }>(
      "regrade_with_reasoning",
      { questionPrompt, userAnswer, rubric, fileData, fileMimeType }
    );
  } catch {
    return { isCorrect: false, score: 0, explanation: "Unable to re-grade right now." };
  }
}

// ─── Data Export ───────────────────────────────────────────

export async function exportData(): Promise<string> {
  if (!isTauri()) return "";
  return tauriInvoke<string>("export_data");
}
