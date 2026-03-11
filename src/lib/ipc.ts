import { tauriInvoke, isTauri } from "@/hooks/useInvoke";
import type { CurriculumState, Concept } from "@/types/concept";
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

export async function getCurriculumState(): Promise<CurriculumState | null> {
  if (!isTauri()) return null;
  return tauriInvoke<CurriculumState>("get_curriculum_state");
}

// ─── Sessions ──────────────────────────────────────────────

interface DailySessionResponse {
  id: string;
  concepts: Concept[];
  estimatedMinutes: number;
}

export async function getDailySession(): Promise<DailySessionResponse | null> {
  if (!isTauri()) return null;
  return tauriInvoke<DailySessionResponse>("get_daily_session");
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

// ─── Data Export ───────────────────────────────────────────

export async function exportData(): Promise<string> {
  if (!isTauri()) return "";
  return tauriInvoke<string>("export_data");
}
