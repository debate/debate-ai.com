/**
 * @fileoverview The model calls of Online Challenges: the AI opponent's
 * speeches and the AI judge's decision. Prompts and the reply reader live in
 * the package (`debate-challenges/prompts.ts`); this file only picks a key and
 * calls it.
 *
 * Keys are tried in order — the caller's own key (`x-user-ai-key`) first when
 * the request has one, then the site's shared keys — through the same
 * write-language path as `/api/reason-ai` (`lib/ai/key-fallback.ts`). A call
 * that fails on every key returns `null`; the challenge stays where it was
 * (the AI's turn, or `judging`) and the next board read tries again.
 *
 * @module lib/debate-challenges/ai
 */

import { chatUntilAnswered } from "@/lib/ai/free-chat";
import { tryKeysInTurn } from "@/lib/ai/key-fallback";
import { OPENROUTER_FREE_MODEL, parseOwnKeyHeader, sharedProviderKeys, type ProviderKey } from "@/lib/ai/provider-key";
import {
  aiSpeechPrompt,
  judgePrompt,
  parseJudgeReply,
  type PromptRound,
} from "@debate-ai/practice-rounds/src/debate-challenges/prompts";
import type { AiLevel, ChallengeSide } from "@debate-ai/practice-rounds/src/debate-challenges/types";

const ANTHROPIC_MODEL = "claude-sonnet-4-6";
const SPEECH_MAX_TOKENS = 1200;
const JUDGE_MAX_TOKENS = 700;

/** Generates text for one prompt, or `null` when no key answered. Swappable in tests. */
export type ChallengeTextGenerator = (prompt: string, maxTokens: number) => Promise<string | null>;

/** The generator for one request: its own key first (if any), then the shared keys. */
export function challengeTextGenerator(request: Request | null): ChallengeTextGenerator {
  const own = request ? parseOwnKeyHeader(request) : null;
  const keys: ProviderKey[] = [...(own ? [own] : []), ...sharedProviderKeys()];
  return async (prompt, maxTokens) => {
    if (keys.length === 0) return null;
    const result = await tryKeysInTurn(
      keys,
      (key) =>
        chatUntilAnswered({
          key,
          model: key.provider === "openrouter" ? OPENROUTER_FREE_MODEL : ANTHROPIC_MODEL,
          messages: [{ role: "user", content: prompt }],
          maxTokens,
          temperature: 0.7,
        }),
      { ownFallsThrough: true },
    );
    if (result.kind !== "reply") {
      console.error("[debate-challenges] model call failed:", result.kind === "failed" ? result.failure.message : result.kind);
      return null;
    }
    const text = result.reply.text.trim();
    return text || null;
  };
}

/** The AI opponent's next speech, or `null` when no model answered. */
export async function writeAiSpeech(
  generate: ChallengeTextGenerator,
  round: PromptRound,
  level: AiLevel,
): Promise<string | null> {
  const text = await generate(aiSpeechPrompt(round, level), SPEECH_MAX_TOKENS);
  return text ? text.replace(/^#+\s.*\n+/, "").trim() || null : null;
}

/** The judge's decision, or `null` when no model answered with a winner. */
export async function judgeRound(
  generate: ChallengeTextGenerator,
  round: PromptRound,
): Promise<{ winner: ChallengeSide; reason: string } | null> {
  const reply = await generate(judgePrompt(round), JUDGE_MAX_TOKENS);
  return reply ? parseJudgeReply(reply) : null;
}
