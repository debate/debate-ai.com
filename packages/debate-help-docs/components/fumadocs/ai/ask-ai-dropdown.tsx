/**
 * @file ask-ai-dropdown.tsx
 * @description Re-exports `AskAIButton` from the `ask-ai-button` npm package
 * as a drop-in replacement for the previous hand-rolled AskAIDropdown.
 * Also exported as `AskAIDropdown` for backward compatibility.
 */
"use client";

export { AskAIButton } from "ask-ai-button";
export type { AskAIButtonProps, AIProvider, AIProviderID } from "ask-ai-button";

import { AskAIButton } from "ask-ai-button";

export const AskAIDropdown = AskAIButton;
