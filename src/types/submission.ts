export type SubmissionStatus = "pending" | "evaluating" | "reviewed";
export type FeedbackVerdict = "pass" | "revise";

export interface ProjectDefinition {
  id: string;
  conceptIds: string[];
  title: string;
  description: string; // markdown with LaTeX
  requirements: string[];
  acceptedFormats: string[];
  estimatedMinutes: number;
}

export interface Submission {
  id: string;
  projectId: string;
  fileName: string;
  fileType: string;
  filePath: string;
  submittedAt: string;
  status: SubmissionStatus;
  feedback: FeedbackResult | null;
}

export interface FeedbackResult {
  submissionId: string;
  verdict: FeedbackVerdict;
  overallScore: number; // 0–1
  strengths: string[];
  areasForImprovement: string[];
  nextSteps: string[];
  detailedComments: string; // markdown
  evaluatedAt: string;
  xpEarned: number;
}
