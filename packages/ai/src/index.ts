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
  maxLevel,
  type RuleHit,
  type RiskAssessment,
  type TranscriptAnalysis,
} from './scam-guard/detect.js';
export { SCAM_RULES, suggestedActionFor, type ScamRule } from './scam-guard/rules.js';

// Scam Guard — full-context multi-layer engine (rules + wallet/link parser + LLM
// intent classifier + wallet/escrow-state/evidence risk + repetition penalty).
export {
  analyzeMessage,
  analyzeMessageSync,
  type ScamAnalysisInput,
  type ScamAnalysisResult,
} from './scam-guard/analyze.js';
export {
  aggregate,
  ESCROW_THREAT_INTENTS,
  type RiskSignal,
  type AggregateInput,
  type AggregateResult,
  type ComponentRisk,
  type SignalSource,
  type UiAction,
} from './scam-guard/aggregator.js';
export {
  parseWalletsAndLinks,
  type WalletParseInput,
  type WalletParseResult,
  type DetectedAddress,
  type DetectedUrl,
} from './scam-guard/wallet-parser.js';
export {
  scoreWalletRisk,
  type WalletRiskProfile,
  type WalletRiskResult,
} from './scam-guard/wallet-risk.js';
export { scoreEscrowStateRisk, type EscrowStateRisk } from './scam-guard/deal-state.js';
export {
  scoreEvidenceRisk,
  type EvidenceItem,
  type EvidenceKind,
  type EvidenceRiskInput,
  type EvidenceRiskResult,
} from './scam-guard/evidence-risk.js';
export {
  classifyIntents,
  type LlmIntentSignal,
  type LlmClassifierContext,
} from './scam-guard/llm-classifier.js';

// Re-exported shared helper for convenience
export { scoreToLevel } from '@trustroom/types';
