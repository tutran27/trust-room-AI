// LLM provider (Groq-first, OpenAI-compatible; never throws on missing key when guarded)
export {
  LLMClient,
  type LLMConfig,
  type ChatMessageParam,
  type ChatOptions,
  createLLMClient,
  getLLMClient,
  llmAvailable,
} from './llm.js';

// Embeddings
export {
  EmbeddingClient,
  embedText,
  embedTexts,
  generateEmbedding,
  generateEmbeddings,
  cosineSimilarity,
} from './embeddings.js';

// LLM-backed modules (each degrades to a deterministic heuristic fallback)
export { extractTerms, extractTermsHeuristic, type ExtractedTermsResult } from './term-extractor.js';
export {
  classifyRisk,
  classifyRiskHeuristic,
  type DealProfile,
  type RiskClassificationResult,
} from './risk-classifier.js';
export {
  detectScam,
  detectScamHeuristic,
  type ScamDetectionResult,
} from './scam-detector.js';
export {
  summarizeDeal,
  summarizeDealHeuristic,
  type DealSummaryResult,
} from './summarizer.js';
export {
  analyzeChat,
  analyzeChatHeuristic,
  type ChatMessage,
  type ChatAnalysisResult,
} from './chat-analyzer.js';
export {
  analyzeDispute,
  analyzeDisputeHeuristic,
  type DisputeAnalysisResult,
} from './dispute-analyzer.js';
export {
  getRecommendations,
  getRecommendationsHeuristic,
  type DealRecommendation,
  type UserRecommendations,
} from './recommendation-engine.js';

// Scam Guard (deterministic rule layer — the always-available risk engine)
export {
  runRules,
  aggregateRisk,
  analyzeTranscript,
  normalize,
  type RuleHit,
  type RiskAssessment,
  type TranscriptAnalysis,
} from './scam-guard/detect.js';
export { SCAM_RULES, type ScamRule } from './scam-guard/rules.js';

// Re-exported shared helper for convenience
export { scoreToLevel } from '@trustroom/types';
