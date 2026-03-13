import { tauriInvoke, isTauri } from "@/hooks/useInvoke";
import type { CurriculumState, Concept, ConceptState } from "@/types/concept";
import type { LessonContent, ExplanationResponse } from "@/types/lesson";
import type { QuizSession, Question, Answer, Feedback } from "@/types/quiz";
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
  // Backend expects a string value; coerce non-string types
  const stringValue = typeof value === "string" ? value : String(value);
  return tauriInvoke<void>("set_setting", { key, value: stringValue });
}

// ─── API Key ───────────────────────────────────────────────

export async function storeApiKey(apiKey: string): Promise<void> {
  if (!isTauri()) return;
  return tauriInvoke<void>("store_api_key", { apiKey });
}

/** Check whether an API key is stored (without retrieving it). */
export async function hasApiKey(): Promise<boolean> {
  if (!isTauri()) return false;
  return tauriInvoke<boolean>("has_api_key");
}

/** Test the stored API key via a lightweight API call. */
export async function testApiKey(): Promise<{ valid: boolean; message: string }> {
  if (!isTauri()) {
    return { valid: false, message: "Tauri not available in browser mode" };
  }
  try {
    const result = await tauriInvoke<boolean | { valid: boolean; message: string }>("test_api_key");
    // Backend returns bool; normalize to { valid, message }
    if (typeof result === "boolean") {
      return {
        valid: result,
        message: result ? "API key is valid. Connection successful!" : "API key test failed.",
      };
    }
    return result;
  } catch (e) {
    return { valid: false, message: String(e) };
  }
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
    description: String(
      raw.description
        ?? (domain && typeof domain === "object" && "name" in domain
          ? `Explore ${(domain as { name: string }).name}: ${raw.name ?? raw.title ?? ""}`
          : `Learn about ${raw.name ?? raw.title ?? ""}`)
    ),
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

export async function getLesson(
  conceptId: string,
  mistakesContext?: string
): Promise<LessonContent> {
  const raw = await tauriInvoke<LessonContent | string>("get_lesson", {
    conceptId,
    mistakesContext: mistakesContext ?? null,
  });
  return normalizeLessonContent(raw, conceptId);
}

/**
 * Normalize the backend lesson response into the frontend LessonContent shape.
 * Backend may return a structured object or a raw markdown/JSON string.
 */
/**
 * Strip HTML-comment cache tags (e.g. <!-- mastery_band:low -->) that the backend
 * appends to cached payloads for cache invalidation. These must be removed before
 * JSON parsing or rendering.
 */
function stripCacheTags(text: string): string {
  return text.replace(/<!--[\s\S]*?-->/g, "").trim();
}

function normalizeLessonContent(raw: LessonContent | string, conceptId: string): LessonContent {
  if (typeof raw === "object" && raw !== null && "sections" in raw) {
    return raw;
  }

  const text = stripCacheTags(typeof raw === "string" ? raw : JSON.stringify(raw));

  // Try parsing as JSON first
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null) {
      return {
        id: parsed.id ?? `lesson_${conceptId}`,
        conceptId: parsed.conceptId ?? parsed.concept_id ?? conceptId,
        title: parsed.title ?? "",
        summary: parsed.summary ?? "",
        sections: Array.isArray(parsed.sections)
          ? parsed.sections.map((s: Record<string, unknown>, i: number) => ({
              id: s.id ?? `section_${i}`,
              title: String(s.title ?? ""),
              content: String(s.content ?? ""),
              order: Number(s.order ?? i),
            }))
          : [],
        workedExamples: Array.isArray(parsed.workedExamples ?? parsed.worked_examples)
          ? (parsed.workedExamples ?? parsed.worked_examples).map(
              (e: Record<string, unknown>, i: number) => ({
                id: e.id ?? `example_${i}`,
                title: String(e.title ?? ""),
                steps: Array.isArray(e.steps)
                  ? e.steps.map((st: Record<string, unknown>, j: number) => ({
                      id: st.id ?? `step_${j}`,
                      label: String(st.label ?? ""),
                      content: String(st.content ?? ""),
                    }))
                  : [],
              })
            )
          : [],
        strategy: parsed.strategy ?? "default",
        estimatedMinutes: Number(
          parsed.estimatedMinutes ?? parsed.estimated_minutes
            ?? Math.max(5, Math.ceil(
                (Array.isArray(parsed.sections)
                  ? (parsed.sections as { content?: string }[]).reduce(
                      (sum: number, s) => sum + (String(s.content ?? "")).split(/\s+/).length, 0)
                  : 0) / 200))
        ),
        prerequisites: Array.isArray(parsed.prerequisites) ? parsed.prerequisites : [],
      };
    }
  } catch {
    // Not valid JSON — treat as markdown
  }

  // Fallback: parse raw markdown into sections by splitting on top-level headings
  return parseMarkdownIntoLesson(text, conceptId);
}

/**
 * Parse raw markdown into a structured lesson by splitting on headings.
 * Extracts a title from the first # heading, then groups content by ## headings into sections.
 */
function parseMarkdownIntoLesson(markdown: string, conceptId: string): LessonContent {
  const lines = markdown.split("\n");
  let title = "";
  let summary = "";
  const sections: { id: string; title: string; content: string; order: number }[] = [];
  let currentSectionTitle = "";
  let currentSectionLines: string[] = [];
  let sectionIndex = 0;

  const flushSection = () => {
    const content = currentSectionLines.join("\n").trim();
    if (content || currentSectionTitle) {
      // If we have no title yet and this is the first section, use its content as summary
      if (sections.length === 0 && !currentSectionTitle && !title) {
        summary = content;
      } else {
        sections.push({
          id: `section_${sectionIndex}`,
          title: currentSectionTitle || "Lesson",
          content,
          order: sectionIndex,
        });
        sectionIndex++;
      }
    }
    currentSectionTitle = "";
    currentSectionLines = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Top-level heading → lesson title
    const h1Match = trimmed.match(/^#\s+(.+)$/);
    if (h1Match && !title) {
      flushSection();
      title = h1Match[1]!;
      continue;
    }

    // Second-level heading → new section
    const h2Match = trimmed.match(/^##\s+(.+)$/);
    if (h2Match) {
      flushSection();
      currentSectionTitle = h2Match[1]!;
      continue;
    }

    currentSectionLines.push(line);
  }
  flushSection();

  // If we never found any ## headings, wrap everything as one section
  if (sections.length === 0) {
    sections.push({
      id: "section_0",
      title: "Lesson",
      content: markdown.trim(),
      order: 0,
    });
  }

  // Estimate reading time: ~200 words/min, count total words across sections
  const totalWords = sections.reduce((sum, s) => sum + s.content.split(/\s+/).length, 0);
  const estimatedMinutes = Math.max(5, Math.ceil(totalWords / 200));

  return {
    id: `lesson_${conceptId}`,
    conceptId,
    title,
    summary,
    sections,
    workedExamples: [],
    strategy: "default",
    estimatedMinutes,
    prerequisites: [],
  };
}

export async function requestExplanation(
  conceptId: string,
  lessonId: string,
  attempt: number,
  mistakesContext?: string
): Promise<ExplanationResponse> {
  return tauriInvoke<ExplanationResponse>("request_explanation", {
    conceptId,
    lessonId,
    attempt,
    mistakesContext: mistakesContext ?? null,
  });
}

// ─── Quiz ──────────────────────────────────────────────────

export async function getQuiz(
  conceptId: string,
  mistakesContext?: string
): Promise<QuizSession> {
  const raw = await tauriInvoke<QuizSession | string>("get_quiz", {
    conceptId,
    mistakesContext: mistakesContext ?? null,
  });
  return normalizeQuizSession(raw, conceptId);
}

export async function invalidateQuizCache(conceptId: string): Promise<void> {
  await tauriInvoke<void>("invalidate_quiz_cache", { conceptId });
}

/**
 * Normalize the backend quiz response into the frontend QuizSession shape.
 * Backend returns a raw JSON string; the frontend expects a parsed QuizSession.
 */
/**
 * Strip markdown code-block wrappers (```json ... ```) that LLMs sometimes add
 * despite being told not to.
 */
function stripMarkdownCodeBlock(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  return match?.[1]?.trim() ?? trimmed;
}

function normalizeQuestion(q: Record<string, unknown>, i: number, conceptId: string): Question {
  return {
    id: String(q.id ?? `q_${i}`),
    conceptId: String(q.conceptId ?? q.concept_id ?? conceptId),
    type: String(q.type ?? q.questionType ?? q.question_type ?? "multiple_choice") as Question["type"],
    prompt: String(q.prompt ?? q.question ?? ""),
    options: Array.isArray(q.options)
      ? q.options.map((o: Record<string, unknown>, j: number) => ({
          id: String(o.id ?? `opt_${j}`),
          text: String(o.text ?? o.label ?? ""),
          isCorrect: Boolean(o.isCorrect ?? o.is_correct ?? o.correct ?? false),
        }))
      : undefined,
    blanks: Array.isArray(q.blanks ?? q.expectedBlanks ?? q.expected_blanks)
      ? (q.blanks ?? q.expectedBlanks ?? q.expected_blanks) as string[]
      : undefined,
    rubric: (q.rubric as string) ?? undefined,
    difficulty: Number(q.difficulty ?? 1),
    explanation: String(q.explanation ?? ""),
  };
}

function normalizeQuizSession(raw: QuizSession | string, conceptId: string): QuizSession {
  if (typeof raw === "object" && raw !== null && "questions" in raw) {
    return raw;
  }

  const text = stripCacheTags(typeof raw === "string" ? raw : JSON.stringify(raw));

  try {
    const jsonStr = stripMarkdownCodeBlock(text);
    const parsed = JSON.parse(jsonStr);

    // The prompt asks for a JSON array of questions directly (not wrapped in an object).
    // Handle both formats: bare array [...] and object { questions: [...] }.
    let questions: Question[] = [];

    if (Array.isArray(parsed)) {
      questions = parsed.map((q: Record<string, unknown>, i: number) =>
        normalizeQuestion(q, i, conceptId),
      );
    } else if (typeof parsed === "object" && parsed !== null) {
      const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];
      questions = rawQuestions.map((q: Record<string, unknown>, i: number) =>
        normalizeQuestion(q, i, conceptId),
      );
    }

    if (questions.length > 0) {
      const id = Array.isArray(parsed)
        ? `quiz_${conceptId}_${Date.now()}`
        : (parsed.id ?? `quiz_${conceptId}_${Date.now()}`);
      const sessionConceptId = Array.isArray(parsed)
        ? conceptId
        : (parsed.conceptId ?? parsed.concept_id ?? conceptId);

      return {
        id,
        conceptId: sessionConceptId,
        questions,
        answers: [],
        feedbacks: [],
        currentIndex: 0,
        startedAt: Array.isArray(parsed) ? new Date().toISOString() : (parsed.startedAt ?? new Date().toISOString()),
        completedAt: null,
        totalScore: 0,
        xpEarned: 0,
      };
    }

    throw new Error("Quiz response contained no questions.");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to parse quiz response";
    console.error("[normalizeQuizSession]", msg, text.slice(0, 300));
    throw new Error(msg);
  }
}

/** Context about the question so the backend can grade the answer. */
export interface QuestionContext {
  conceptId: string;
  questionType: string;
  prompt: string;
  correctOptionId?: string;
  expectedBlanks?: string[];
  rubric?: string;
  explanation?: string;
}

export async function submitAnswer(
  sessionId: string,
  answer: Answer,
  question: QuestionContext
): Promise<Feedback> {
  return tauriInvoke<Feedback>("submit_answer", { sessionId, answer, question });
}

export async function completeQuiz(
  sessionId: string,
  scores?: number[]
): Promise<{ totalScore: number; xpEarned: number }> {
  return tauriInvoke<{ totalScore: number; xpEarned: number }>(
    "complete_quiz",
    { sessionId, scores: scores ?? [] }
  );
}

export interface NoRightAnswerResult {
  confirmed: boolean;
  explanation: string;
}

export async function verifyNoRightAnswer(
  questionPrompt: string,
  options: string[]
): Promise<NoRightAnswerResult> {
  if (!isTauri()) {
    return { confirmed: false, explanation: "Not available in browser mode." };
  }
  try {
    return await tauriInvoke<NoRightAnswerResult>("verify_no_right_answer", {
      questionPrompt,
      options,
    });
  } catch {
    return { confirmed: false, explanation: "Unable to verify right now." };
  }
}

// ─── Projects ──────────────────────────────────────────────

export async function getProjects(): Promise<ProjectDefinition[]> {
  if (!isTauri()) return [];
  const raw = await tauriInvoke<Record<string, unknown>[]>("get_projects");
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeProjectDefinition);
}

/**
 * Normalize backend ProjectInfo into frontend ProjectDefinition.
 * Backend returns submission-shaped objects; frontend expects project metadata.
 */
function normalizeProjectDefinition(raw: Record<string, unknown>): ProjectDefinition {
  return {
    id: String(raw.id ?? raw.project_id ?? raw.projectId ?? ""),
    conceptIds: Array.isArray(raw.conceptIds ?? raw.concept_ids)
      ? (raw.conceptIds ?? raw.concept_ids) as string[]
      : raw.concept_id || raw.conceptId
        ? [String(raw.concept_id ?? raw.conceptId)]
        : [],
    title: String(raw.title ?? raw.name ?? `Project ${raw.id ?? ""}`),
    description: String(raw.description ?? raw.feedback ?? ""),
    requirements: Array.isArray(raw.requirements) ? raw.requirements as string[] : [],
    acceptedFormats: Array.isArray(raw.acceptedFormats ?? raw.accepted_formats)
      ? (raw.acceptedFormats ?? raw.accepted_formats) as string[]
      : [".pdf", ".png", ".jpg", ".txt"],
    estimatedMinutes: Number(raw.estimatedMinutes ?? raw.estimated_minutes ?? 30),
  };
}

export async function submitProject(
  projectId: string,
  filePath: string
): Promise<Submission> {
  const raw = await tauriInvoke<Record<string, unknown>>(
    "submit_project",
    { submission: { conceptId: projectId, projectId, filePath } }
  );
  return normalizeSubmission(raw);
}

/**
 * Normalize backend ProjectInfo into frontend Submission.
 */
function normalizeSubmission(raw: Record<string, unknown>): Submission {
  const feedbackText = raw.feedback ?? raw.feedbackJson ?? raw.feedback_json;
  let feedback: FeedbackResult | null = null;
  if (feedbackText && typeof feedbackText === "string") {
    try {
      const parsed = JSON.parse(feedbackText);
      feedback = parsed as FeedbackResult;
    } catch {
      feedback = {
        submissionId: String(raw.id ?? ""),
        verdict: raw.status === "reviewed" ? "pass" : "revise",
        overallScore: 0.8,
        strengths: [],
        areasForImprovement: [],
        nextSteps: [],
        detailedComments: feedbackText,
        evaluatedAt: String(raw.submitted_at ?? raw.submittedAt ?? ""),
        xpEarned: 25,
      };
    }
  } else if (typeof feedbackText === "object" && feedbackText !== null) {
    feedback = feedbackText as FeedbackResult;
  }

  const filePath = String(raw.file_path ?? raw.filePath ?? "");
  return {
    id: String(raw.id ?? ""),
    projectId: String(raw.project_id ?? raw.projectId ?? ""),
    fileName: filePath.split("/").pop() ?? "",
    fileType: String(raw.mime_type ?? raw.mimeType ?? ""),
    filePath,
    submittedAt: String(raw.submitted_at ?? raw.submittedAt ?? ""),
    status: (raw.status as "pending" | "evaluating" | "reviewed") ?? "pending",
    feedback,
  };
}

export async function getSubmissions(
  projectId?: string
): Promise<Submission[]> {
  if (!isTauri()) return [];
  const raw = await tauriInvoke<Record<string, unknown>[]>("get_submissions", { projectId });
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeSubmission);
}

export async function getSubmissionFeedback(
  submissionId: string
): Promise<FeedbackResult | null> {
  if (!isTauri()) return null;
  try {
    return await tauriInvoke<FeedbackResult>("get_submission_feedback", {
      submissionId,
    });
  } catch {
    return null;
  }
}

// ─── Gamification ──────────────────────────────────────────

export async function getGamificationState(): Promise<GamificationState | null> {
  if (!isTauri()) return null;
  const raw = await tauriInvoke<Record<string, unknown>>("get_gamification_state");
  if (!raw) return null;
  return normalizeGamificationState(raw);
}

/**
 * Normalize the backend GamificationState into the frontend shape.
 * Handles both the new nested shape and legacy flat shape for robustness.
 */
function normalizeGamificationState(raw: Record<string, unknown>): GamificationState {
  // XP: accept either "xp" (new) or "total_xp"/"totalXp" (legacy)
  const xp = Number(raw.xp ?? raw.totalXp ?? raw.total_xp ?? 0);

  // Level: accept nested object (new) or flat integer (legacy)
  const level =
    typeof raw.level === "object" && raw.level !== null
      ? (raw.level as GamificationState["level"])
      : {
          current: Number(raw.level ?? 1),
          title: "",
          xpForCurrent: 0,
          xpForNext: Number(raw.xpToNextLevel ?? raw.xp_to_next_level ?? 100),
          progress: 0,
        };

  // Streak: accept nested object (new) or flat fields (legacy)
  const streak =
    typeof raw.streak === "object" && raw.streak !== null
      ? (raw.streak as GamificationState["streak"])
      : {
          currentDays: Number(raw.currentStreakDays ?? raw.current_streak_days ?? 0),
          longestDays: Number(raw.longestStreakDays ?? raw.longest_streak_days ?? 0),
          todayCompleted: false,
          freezesAvailable: 0,
          freezeActive: false,
          lastActiveDate: "",
        };

  const badges = Array.isArray(raw.badges)
    ? (raw.badges as GamificationState["badges"])
    : [];

  const recentXpEvents = Array.isArray(raw.recentXpEvents)
    ? (raw.recentXpEvents as GamificationState["recentXpEvents"])
    : [];

  return { xp, level, streak, badges, recentXpEvents };
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

// ─── Save Progress ────────────────────────────────────────

/** Trigger an immediate mastery snapshot to persist all learning progress. */
export async function saveProgress(): Promise<void> {
  if (!isTauri()) return;
  return tauriInvoke<void>("save_progress");
}

// ─── Data Export ───────────────────────────────────────────

export async function exportData(): Promise<string> {
  if (!isTauri()) return "";
  return tauriInvoke<string>("export_data");
}
