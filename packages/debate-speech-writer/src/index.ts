/**
 * @fileoverview Public entry point for the debate speech-writer package.
 *
 * Exposes the prompt library used by the AI speech/flow features and the batch
 * quote-analysis helper that scores cards for warrants and flaws.
 *
 * @module debate-speech-writer
 */

export { analyzeQuotes } from "./analysis/analyze-quotes";

export { findFlawsPrompt } from "./prompts/quote-to-find-flaws";
export { judgeDecisionPrompt } from "./prompts/judge-decision-options";
export { speechToFlowPrompt } from "./prompts/speech-to-flow";
export { speechToResponsePrompt } from "./prompts/speech-to-response";
export { textToHighlightedPrompt } from "./prompts/text-to-highlighted";
export { topicToResearchOutlinePrompt } from "./prompts/topic-to-research-outline";
