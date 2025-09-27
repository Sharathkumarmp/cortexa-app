export interface CriterionFeedback {
  criterion: string;
  score: number;
  maxScore: number;
  feedback: string;
}

export interface SimilarityCheckResult {
  score: number; // A percentage from 0 to 100
  summary: string;
}

export interface AIContentCheckResult {
  likelihood: string; // e.g., "High", "Medium", "Low"
  summary: string;
}

export interface EvaluationResult {
  overallScore: number;
  maxScore: number;
  summaryFeedback: string;
  detailedBreakdown: CriterionFeedback[];
  similarityCheck?: SimilarityCheckResult;
  aiContentCheck?: AIContentCheckResult;
}

export interface FileEvaluationResult {
  fileName: string;
  studentName?: string;
  studentRollNo?: string;
  data: EvaluationResult | null;
  error: string | null;
}

export interface ReportDetails {
  evaluatorName: string;
  evaluatorDesignation: string;
  institution: string;
  assignmentName: string;
  courseName: string;
}
