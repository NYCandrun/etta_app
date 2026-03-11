export type ExplanationStrategy =
  | "default"
  | "analogy"
  | "visual"
  | "step_by_step"
  | "basics_review";

export interface LessonSection {
  id: string;
  title: string;
  content: string; // markdown with LaTeX
  order: number;
}

export interface WorkedExampleStep {
  id: string;
  label: string;
  content: string; // markdown with LaTeX
}

export interface WorkedExample {
  id: string;
  title: string;
  steps: WorkedExampleStep[];
}

export interface LessonContent {
  id: string;
  conceptId: string;
  title: string;
  summary: string;
  sections: LessonSection[];
  workedExamples: WorkedExample[];
  strategy: ExplanationStrategy;
  estimatedMinutes: number;
  prerequisites: string[];
}

export interface ExplanationRequest {
  conceptId: string;
  lessonId: string;
  attempt: number; // escalation counter
  strategy: ExplanationStrategy;
  userMessage?: string;
}

export interface ExplanationResponse {
  content: string; // markdown with LaTeX
  strategy: ExplanationStrategy;
  nextStrategy: ExplanationStrategy | null;
}
