export type DocumentType = "scientific_tz" | "grant_application" | "niokr" | "research_document";

export type Severity = "high" | "medium" | "low";

export type InsightSource = "rule" | "llm";

export interface CriteriaScores {
  clarity: number;
  completeness: number;
  kpi: number;
  logic: number;
  scientific: number;
  structure: number;
}

export interface AnalysisIssue {
  title: string;
  description: string;
  severity: Severity;
  confidence: number;
  source: InsightSource;
  evidence?: string;
}

export interface MissingBlock {
  block: string;
  reason: string;
  confidence: number;
  source: InsightSource;
}

export interface Recommendation {
  title: string;
  action: string;
  impact: string;
  confidence: number;
  source: InsightSource;
}

export interface AnalysisMeta {
  mode: "rules" | "hybrid";
  model?: string;
  usedDomainContext: boolean;
  usedFewShot: boolean;
  usedCompressedPrompt?: boolean;
  promptTokenEstimate?: number;
  generatedAt: string;
  documentType: DocumentType;
}

export interface AnalysisResult {
  overallScore: number;
  criteriaScores: CriteriaScores;
  issues: AnalysisIssue[];
  missingBlocks: MissingBlock[];
  recommendations: Recommendation[];
  improvedVersion: string;
  confidenceSummary: Record<string, number>;
  ruleSummary: string[];
  llmSummary?: string;
  analysisMeta: AnalysisMeta;
}
