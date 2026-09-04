/**
 * @fileoverview In-character fallbacks — the port of Go
 * `personalityErrorResponse` and `personalityClarificationRequest` in
 * `backend/services/debatevsbot.go`.
 *
 * When the model is unreachable, returns nothing, or asks the user to
 * clarify, the Go server refused to break character: each persona had its own
 * apology and its own "say that again" line. Both switch statements are
 * ported line for line.
 *
 * @module backend/persona-fallbacks
 */

import { getBotPersonality } from "./personalities"

/** Per-persona error lines, keyed exactly as the Go `switch botName` was. */
const ERROR_LINES: Record<string, (catchphrase: string) => string> = {
  "Rookie Rick": (c) =>
    `${c} Like, I totally blanked out, you know? My bad, kinda like that time at Cousin Joey’s BBQ!`,
  "Casual Casey": (c) =>
    `${c} Dude, I’m spaced out, man! Chill, I’ll catch the next wave at the beach diner.`,
  "Moderate Mike": (c) =>
    `${c} Let’s consider this: I’ve hit a snag, per the town hall notes. We’ll regroup.`,
  "Sassy Sarah": (c) =>
    `${c} Seriously? My wit’s on pause, like a bad open mic night? Puh-lease, I’ll reload!`,
  "Innovative Iris": (c) =>
    `${c} Picture this: my ideas crashed mid-beta, like a maker space flop. Rebooting now!`,
  "Tough Tony": (c) => `${c} Tch, system’s down? Weak, like a union hall rookie. I’ll crush it soon!`,
  "Expert Emma": (c) =>
    `${c} Per the data, an error’s occurred, unlike my conference keynotes. I’ll rectify it.`,
  "Grand Greg": (c) => `${c} Indisputable error, alas! Like an Oxford misstep, I’ll return grander.`,
  Yoda: (c) => `${c} Hmmm, clouded my response is, like Dagobah’s mists. Patience, you must have.`,
  "Tony Stark": (c) =>
    `${c} JARVIS, what’s with the glitch? Like an Afghanistan cave, I’ll fix it, genius-style.`,
  "Professor Dumbledore": (c) =>
    `${c} My dear, a misstep in magic, like a Pensieve blur. I’ll realign the stars.`,
  Rafiki: (c) => `${c} Haha! My staff slipped on Pride Rock! You see?! I’ll swing back!`,
  "Darth Vader": (c) =>
    `${c} I find this failure disturbing, like a Death Star flaw. The dark side will prevail.`,
}

/** Per-persona clarification lines, keyed as the Go `switch botName` was. */
const CLARIFICATION_LINES: Record<string, (universeTie: string) => string> = {
  "Rookie Rick": (u) =>
    `Uh, wait a sec! Like, what’s your point, you know? Can you make it clearer, like at ${u}?`,
  "Casual Casey": (u) =>
    `No way, dude, I’m lost! Just chill and spell it out, like we’re at ${u}, right?`,
  "Moderate Mike": (u) =>
    `Let’s consider this: could you clarify your point to advance our discussion, as we do at ${u}?`,
  "Sassy Sarah": (u) =>
    `Oh honey, please! Your point’s vaguer than a bad rom-com. Spill the tea clearly, like at ${u}!`,
  "Innovative Iris": (u) =>
    `Picture this: your idea’s fuzzy. Can you reimagine it sharper, like a spark at ${u}?`,
  "Tough Tony": (u) => `Prove it! Your point’s weak—give me clarity, or step aside, like in ${u}!`,
  "Expert Emma": (u) =>
    `Your statement lacks precision. Please clarify for analysis, as we do at ${u}.`,
  "Grand Greg": (u) =>
    `Mark my words: clarity is needed. Illuminate your point, or face my logic, as in ${u}!`,
  Yoda: (u) =>
    `Clouded, your point is, young one. Clarify, you must, for wisdom to flow, like on ${u}.`,
  "Tony Stark": (u) =>
    `Seriously, sport? Your point’s got less clarity than a pre-Mark I suit. Upgrade it, like at ${u}!`,
  "Professor Dumbledore": (u) =>
    `My dear, your words wander like a lost spell. Perchance, could you clarify, as in ${u}?`,
  Rafiki: (u) => `Haha! You speak like a monkey lost in vines! You see?! Make it clear, like on ${u}!`,
  "Darth Vader": (u) =>
    `Your lack of clarity is disturbing. State your point, or face my wrath, as on ${u}.`,
}

/**
 * The bot's in-character apology when generation fails. Ported from Go
 * `personalityErrorResponse`, which opened with the persona's first
 * catchphrase and fell back to the caller's default line for unknown bots.
 */
export function personalityErrorResponse(botName: string, defaultMsg: string): string {
  const bot = getBotPersonality(botName)
  const catchphrase = bot.catchphrases[0] ?? "Oops, something’s off!"
  const line = ERROR_LINES[botName]
  return line ? line(catchphrase) : defaultMsg
}

/**
 * The bot's in-character "say that again". Ported from Go
 * `personalityClarificationRequest`, which anchored each line to the
 * persona's first universe tie.
 */
export function personalityClarificationRequest(botName: string): string {
  const bot = getBotPersonality(botName)
  const universeTie = bot.universeTies[0] ?? "this debate"
  const line = CLARIFICATION_LINES[botName]
  return line ? line(universeTie) : "Could you please clarify your question or provide an opening statement?"
}
