/**
 * reason-editor — AI tools public API.
 *
 * These are the same commands wired into `Toolbar.tsx`'s AI button
 * group (shown via `showAiTools`); exported separately so a host can
 * call them directly (e.g. from a context menu) or repoint the proxy
 * endpoint with `configureReasonAi`. See THIRD-PARTY-NOTICES.md for
 * how these relate to CardMirror's upstream AI features.
 */

export {
  AnthropicError,
  VISION_MEDIA_TYPES,
  callAnthropic,
  configureReasonAi,
} from "./anthropic-client.js";
export type {
  AnthropicContentBlock,
  AnthropicMessage,
  AnthropicReply,
  AnthropicRequest,
} from "./anthropic-client.js";

export { DEFAULT_AI_CITE_PROMPT, runAiCite } from "./cite-creator.js";
export type { AiCiteResult } from "./cite-creator.js";

export { DEFAULT_REPAIR_PROMPT, runAiRepairText } from "./repair-text.js";
export type { AiRepairResult, RepairFix } from "./repair-text.js";

export { EXPLAIN_SYSTEM_PROMPT, runAiExplain } from "./explain.js";
export type { ExplainContext, ExplainImage } from "./explain.js";

export { getSelectedImage, runAiAltText } from "./image-alt-text.js";
