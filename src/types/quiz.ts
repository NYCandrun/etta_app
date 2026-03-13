export type QuestionType = "multiple_choice" | "free_response" | "fill_in_blank";

export interface MultipleChoiceOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface Question {
  id: string;
  conceptId: string;
  type: QuestionType;
  prompt: string; // may contain LaTeX
  options?: MultipleChoiceOption[]; // for multiple_choice
  blanks?: string[]; // expected answers for fill_in_blank
  rubric?: string; // grading guidance for free_response
  hint?: string;
  difficulty: number; // 1–5
  explanation: string; // shown after answering
}

export interface Answer {
  questionId: string;
  selectedOptionId?: string; // multiple_choice
  freeText?: string; // free_response
  filledBlanks?: string[]; // fill_in_blank
  timeSpentMs: number;
}

export interface StruggleAlert {
  isStruggling: boolean;
  recommendation?: string;
  revisitPrerequisites: string[]; // concept IDs
}

export interface Feedback {
  questionId: string;
  isCorrect: boolean;
  score: number; // 0–1
  explanation: string;
  encouragement: string;
  nextHint?: string;
  struggleAlert?: StruggleAlert;
}

/** A specific mistake the user made, for feeding into reinforcement lessons. */
export interface MistakeDetail {
  questionPrompt: string;
  userAnswer: string;
  correctAnswer: string;
  explanation: string;
}

export interface QuizSession {
  id: string;
  conceptId: string;
  questions: Question[];
  answers: Answer[];
  feedbacks: Feedback[];
  currentIndex: number;
  startedAt: string;
  completedAt: string | null;
  totalScore: number; // 0–1
  xpEarned: number;
}
