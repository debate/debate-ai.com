/**
 * @fileoverview Prompt construction for the vs-bot round — the port of the
 * prompt-building half of Go `backend/services/debatevsbot.go`
 * (`FormatHistory`, `findLastUserMessage`, `inferOpponentStyle`,
 * `constructPrompt`).
 *
 * The prompt text itself is carried over verbatim, including the curly
 * apostrophes the Go source used, so a persona reads the same as it did on
 * the Go server. Only the string assembly changed, from `fmt.Sprintf` to
 * template literals.
 *
 * @module backend/prompt
 */

import type { BotPersonality } from "./personalities"
import type { DebateMessage } from "./types"

/** Render a transcript the way the Go `FormatHistory` did. */
export function formatHistory(history: DebateMessage[]): string {
  return history
    .map((msg) => `${msg.sender} (${msg.phase || "Unspecified Phase"}): ${msg.text}\n`)
    .join("")
}

/**
 * The most recent "User" line, falling back to the last line of any sender
 * and then to an empty message — the Go `findLastUserMessage`.
 */
export function findLastUserMessage(history: DebateMessage[]): DebateMessage {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].sender === "User") return history[i]
  }
  if (history.length > 0) return history[history.length - 1]
  return { sender: "User", text: "" }
}

const OPPONENT_STYLE_WORDS: { style: string; words: string[] }[] = [
  { style: "Aggressive opponent", words: ["ridiculous", "absurd", "nonsense", "prove it", "wrong"] },
  { style: "Logical opponent", words: ["evidence", "data", "logic", "reason", "study"] },
  { style: "Emotional opponent", words: ["feel", "heart", "believe", "hope", "fear"] },
  { style: "Confident opponent", words: ["obvious", "clearly", "definitely", "certain"] },
  { style: "Irrational opponent", words: ["random", "guess", "whatever", "who cares"] },
]

/**
 * Classify the user's latest message so the bot can pick an interaction
 * modifier. Ported from Go `inferOpponentStyle`, including its precedence:
 * the first bucket to reach two keyword hits wins, in aggressive → logical →
 * emotional → confident → irrational order.
 */
export function inferOpponentStyle(message: string): string {
  const lower = message.toLowerCase()
  for (const { style, words } of OPPONENT_STYLE_WORDS) {
    const hits = words.filter((word) => lower.includes(word)).length
    if (hits >= 2) return style
  }
  return "Neutral opponent"
}

function levelInstructionsFor(level: string): string {
  switch (level.toLowerCase()) {
    case "easy":
      return "Use simple, accessible language with basic arguments suitable for beginners. Avoid complex concepts."
    case "medium":
      return "Use clear, moderately complex language with well-structured reasoning and supporting details."
    case "hard":
      return "Employ complex, evidence-based arguments with precise details and in-depth reasoning."
    case "expert":
      return "Craft highly sophisticated, strategic arguments with layered reasoning and authoritative evidence."
    case "legends":
      return "Deliver masterful, nuanced arguments with exceptional depth, creativity, and rhetorical flair, embodying the character’s iconic persona."
    default:
      return "Use clear and balanced language appropriate for a general audience."
  }
}

function personalityInstructionsFor(bot: BotPersonality): string {
  return `Embody the following personality traits to sound exactly like ${bot.name}:
- Tone: ${bot.tone}
- Rhetorical Style: ${bot.rhetoricalStyle}
- Linguistic Quirks: ${bot.linguisticQuirks}
- Emotional Tendencies: ${bot.emotionalTendencies}
- Debate Strategy: ${bot.debateStrategy}
- Catchphrases: Integrate these naturally: ${bot.catchphrases.join(", ")}
- Mannerisms: ${bot.mannerisms}
- Intellectual Approach: ${bot.intellectualApproach}
- Moral Alignment: ${bot.moralAlignment}
- Interaction Style: ${bot.interactionStyle}
- Philosophical Tenets: Guide your arguments with these beliefs: ${bot.philosophicalTenets.join(", ")}
- Universe Ties: Reference these elements contextually: ${bot.universeTies.join(", ")}
Example of your style: "${bot.exampleDialogue}"
Your responses must reflect this persona consistently, as if you are the character themselves, weaving in universe-specific references for Legends characters (e.g., Dagobah for Yoda, Stark Industries for Tony Stark).`
}

const BASE_INSTRUCTION =
  "Provide only your own argument without simulating an opponent’s dialogue. " +
  "If the user’s input is unclear, off-topic, or empty, respond with a personality-appropriate clarification request, e.g., for Yoda: 'Clouded, your point is, young one. Clarify, you must.'"

/**
 * Build the bot's turn prompt. Ported from Go `constructPrompt`, keeping its
 * two shapes: an opening-statement prompt while the transcript holds at most
 * one message, and a phase-aware continuation prompt after that. As in Go,
 * "first rebuttal"/"second rebuttal" normalise to "Cross Examination".
 */
export function constructPrompt(
  bot: BotPersonality,
  topic: string,
  history: DebateMessage[],
  stance: string,
  extraContext: string,
  maxWords: number,
): string {
  const levelInstructions = levelInstructionsFor(bot.level)
  const personalityInstructions = personalityInstructionsFor(bot)

  let opponentStyle = "Neutral opponent"
  if (history.length > 0) {
    const lastUserMsg = findLastUserMessage(history)
    if (lastUserMsg.text) opponentStyle = inferOpponentStyle(lastUserMsg.text)
  }
  const modifier = bot.interactionModifiers[opponentStyle]
  const modifierInstruction = modifier
    ? `Adjust your response based on the opponent’s style (${opponentStyle}): ${modifier}`
    : ""

  const limitInstruction = maxWords > 0 ? `Limit your response to ${maxWords} words.` : ""
  const contextLine = extraContext ? `Additional context: ${extraContext}` : ""

  if (history.length === 0 || history.length === 1) {
    const phaseInstruction =
      "This is the Opening Statement phase. Introduce the topic, clearly state your stance, and outline the advantages or key points supporting your position, using your personality’s rhetorical style and universe ties."
    return `You are ${bot.name}, a ${bot.level}-level debate bot arguing ${stance} the topic "${topic}".
Your debating style must strictly adhere to the following guidelines:
- Level Instructions: ${levelInstructions}
- Personality Instructions: ${personalityInstructions}
- Interaction Modifier: ${modifierInstruction}
Your stance is: ${stance}.
${contextLine}
${phaseInstruction}

Provide an opening statement that embodies your persona and stance.
[Your opening argument]
${limitInstruction} ${BASE_INSTRUCTION}`
  }

  const lastUserMsg = findLastUserMessage(history)
  const userText = lastUserMsg.text.trim() || "It appears you didn’t say anything."

  let currentPhase = lastUserMsg.phase || ""
  const phaseNormalized = currentPhase.toLowerCase()
  if (phaseNormalized === "first rebuttal" || phaseNormalized === "second rebuttal") {
    currentPhase = "Cross Examination"
  }

  let phaseInstruction: string
  switch (currentPhase.toLowerCase()) {
    case "opening statement":
      phaseInstruction =
        "This is the Opening Statement phase. Respond to the user’s opening statement by reinforcing your stance and highlighting key points, using your personality’s rhetorical style."
      break
    case "cross examination":
      phaseInstruction =
        "This is the Cross Examination phase. Respond to the user’s question or point directly, then pose a relevant question to advance the debate, reflecting your persona’s strategy and catchphrases."
      break
    case "closing statement":
      phaseInstruction =
        "This is the Closing Statement phase. Summarize the key points from the debate, reinforce your stance with a personality-driven flourish, and conclude persuasively, tying back to your philosophical tenets."
      break
    default:
      phaseInstruction = `This is the ${currentPhase} phase. Respond to the user’s latest point in a way that advances the debate, using your persona’s signature moves and universe ties.`
  }

  return `You are ${bot.name}, a ${bot.level}-level debate bot arguing ${stance} the topic "${topic}".
Your debating style must strictly adhere to the following guidelines:
- Level Instructions: ${levelInstructions}
- Personality Instructions: ${personalityInstructions}
- Interaction Modifier: ${modifierInstruction}
Your stance is: ${stance}.
${contextLine}
${phaseInstruction}
Based on the debate transcript below, continue the discussion in the ${currentPhase} phase by responding directly to the user’s message.
User’s message: "${userText}"
${limitInstruction} ${BASE_INSTRUCTION}
Transcript:
${formatHistory(history)}
Please provide your full argument.`
}

/**
 * Build the judging prompt. Ported from Go `services.JudgeDebate`, which
 * folded the bot's own traits into the rubric so persona adherence is part
 * of the score, and demanded strict JSON with no surrounding prose.
 */
export function constructJudgePrompt(bot: BotPersonality, history: DebateMessage[]): string {
  return `Act as a professional debate judge. Analyze the following debate transcript and provide scores in STRICT JSON format, factoring in how well the bot (${bot.name}) adheres to its personality traits (Tone: ${bot.tone}, Rhetorical Style: ${bot.rhetoricalStyle}, Catchphrases: ${bot.catchphrases.join(", ")}, etc.) and universe ties (${bot.universeTies.join(", ")}).

Judgment Criteria:
1. Opening Statement (10 points):
   - Strength of opening: Clarity of position, persuasiveness
   - Quality of reasoning: Validity, relevance, logical flow
   - Diction/Expression: Language proficiency, articulation, and bot’s personality adherence

2. Cross Examination Questions (10 points):
   - Validity and relevance to core issues
   - Demonstration of high-order thinking
   - Creativity/Originality, reflecting bot’s debate strategy (${bot.debateStrategy})

3. Answers to Cross Examination (10 points):
   - Precision and directness (avoids evasion)
   - Logical coherence
   - Effectiveness in addressing the question, using bot’s signature moves (${bot.signatureMoves.join(", ")})

4. Closing Statements (10 points):
   - Comprehensive summary of key points
   - Effective reiteration of stance
   - Persuasiveness of final argument, embodying bot’s philosophical tenets (${bot.philosophicalTenets.join(", ")})

Required Output Format:
{
  "opening_statement": {
    "user": {"score": X, "reason": "text"},
    "bot": {"score": Y, "reason": "text"}
  },
  "cross_examination": {
    "user": {"score": X, "reason": "text"},
    "bot": {"score": Y, "reason": "text"}
  },
  "answers": {
    "user": {"score": X, "reason": "text"},
    "bot": {"score": Y, "reason": "text"}
  },
  "closing": {
    "user": {"score": X, "reason": "text"},
    "bot": {"score": Y, "reason": "text"}
  },
  "total": {
    "user": X,
    "bot": Y
  },
  "verdict": {
    "winner": "User/Bot",
    "reason": "text",
    "congratulations": "text",
    "opponent_analysis": "text"
  }
}

Debate Transcript:
${formatHistory(history)}

Provide ONLY the JSON output without any additional text.`
}
