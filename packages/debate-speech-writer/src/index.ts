/**
 * @fileoverview Public entry point for the debate speech-writer package.
 *
 * Exposes the prompt library used by the AI speech/flow features, the batch
 * quote-analysis helper that scores cards for warrants and flaws, and the
 * configurable judge-paradigm registry for AI judge decisions.
 *
 * @module debate-speech-writer
 */

export { analyzeQuotes } from "./analysis/analyze-quotes";

export {
  judgeParadigms,
  judgeParadigmIds,
  isBuiltinJudgeParadigmId,
  getJudgeParadigm,
  listJudgeParadigms,
  buildCustomJudgeParadigm,
  buildJudgeParadigmPrompt,
} from "./judge/judge-paradigms";
export type {
  BuiltinJudgeParadigmId,
  JudgeParadigmId,
  JudgeParadigm,
  CustomJudgeParadigmInput,
} from "./judge/judge-paradigms";

export { findFlawsPrompt } from "./prompts/quote-to-find-flaws";
export { judgeDecisionPrompt } from "./prompts/judge-decision-options";
export { speechToFlowPrompt } from "./prompts/speech-to-flow";
export { speechToResponsePrompt } from "./prompts/speech-to-response";
export { textToHighlightedPrompt } from "./prompts/text-to-highlighted";
export { topicToResearchOutlinePrompt } from "./prompts/topic-to-research-outline";
