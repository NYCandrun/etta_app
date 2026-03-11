export type ConceptState = "locked" | "unlocked" | "in_progress" | "mastered";

export interface Concept {
  id: string;
  name: string;
  description: string;
  domain: CurriculumDomain;
  moduleId: string;
  state: ConceptState;
  masteryScore: number; // 0–1
  prerequisites: string[]; // concept IDs
  estimatedMinutes: number;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
}

export interface CurriculumDomain {
  id: string;
  name: string;
  description: string;
  color: string;
  iconName: string;
  moduleIds: string[];
}

export interface Module {
  id: string;
  name: string;
  description: string;
  domainId: string;
  conceptIds: string[];
  order: number;
}

export interface CurriculumState {
  domains: CurriculumDomain[];
  modules: Module[];
  concepts: Concept[];
  totalMastery: number; // 0–1
  conceptsCompleted: number;
  conceptsTotal: number;
}
