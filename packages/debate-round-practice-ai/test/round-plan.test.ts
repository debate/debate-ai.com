/**
 * @fileoverview The round plan: topic presets, sanitizing a client's plan,
 * the real-round prompt block, and how a plan reaches the bot's prompt.
 */

import { describe, expect, it } from "vitest"
import { buildFallbackCaseBrief, constructCasePrepPrompt } from "../src/backend/case-prep"
import { createStaticModelClient } from "../src/backend/model-client"
import { getBotPersonality } from "../src/backend/personalities"
import { constructPrompt } from "../src/backend/prompt"
import {
  DEFAULT_PRACTICE_TOPIC,
  MAX_PLAN_ARGUMENTS,
  NATIONAL_HEALTHCARE_PRESET,
  NATIONAL_HEALTHCARE_TOPIC,
  constructRoundPlanInstructions,
  findTopicPreset,
  sanitizeRoundPlan,
} from "../src/backend/round-plan"
import { generateBotResponse } from "../src/backend/service"
import type { RoundPlan } from "../src/backend/types"

const plan: RoundPlan = {
  evidence: "with",
  affPlan: NATIONAL_HEALTHCARE_PRESET.affPlan,
  userArguments: [{ title: "Uninsured Deaths advantage", kind: "advantage" }],
  botArguments: [
    { title: "Spending / Debt DA", kind: "disad", summary: "Link: trillions in new spending." },
    { title: "Politics DA", kind: "disad" },
  ],
  cards: [{ tag: "Single payer costs $32 trillion", cite: "Blahous '18" }],
}

describe("topic presets", () => {
  it("defaults to the national health insurance topic with a single-payer aff and neg disads", () => {
    expect(DEFAULT_PRACTICE_TOPIC).toBe(NATIONAL_HEALTHCARE_TOPIC)
    expect(NATIONAL_HEALTHCARE_PRESET.affPlan).toMatch(/single-payer/i)
    const defaults = NATIONAL_HEALTHCARE_PRESET.negArguments.filter((a) =>
      NATIONAL_HEALTHCARE_PRESET.defaultNeg.includes(a.id),
    )
    expect(defaults.length).toBeGreaterThanOrEqual(3)
    expect(defaults.every((a) => a.kind === "disad")).toBe(true)
  })

  it("matches a preset regardless of case and spacing, and not a custom topic", () => {
    expect(findTopicPreset(`  ${NATIONAL_HEALTHCARE_TOPIC.toUpperCase().replace(/ /g, "  ")} `)).toBe(
      NATIONAL_HEALTHCARE_PRESET,
    )
    expect(findTopicPreset("Resolved: Pineapple belongs on pizza.")).toBeNull()
  })
})

describe("sanitizeRoundPlan", () => {
  it("rejects non-objects and clips and caps what it keeps", () => {
    expect(sanitizeRoundPlan(null)).toBeNull()
    expect(sanitizeRoundPlan("plan")).toBeNull()
    const clean = sanitizeRoundPlan({
      evidence: "with",
      userArguments: Array.from({ length: 20 }, (_, i) => ({ title: `Arg ${i}`.padEnd(500, "x") })),
      botArguments: [{ title: "" }, { nope: true }, 7],
      cards: [{ tag: "Card", cite: "Cite" }],
    })!
    expect(clean.userArguments).toHaveLength(MAX_PLAN_ARGUMENTS)
    expect(clean.userArguments[0].title.length).toBe(200)
    expect(clean.botArguments).toEqual([])
    expect(clean.cards).toEqual([{ tag: "Card", cite: "Cite" }])
  })

  it("drops cards in a round without evidence", () => {
    expect(sanitizeRoundPlan({ evidence: "without", cards: [{ tag: "Card" }] })!.cards).toEqual([])
  })
})

describe("constructRoundPlanInstructions", () => {
  it("has a negative bot read its disads as off-case and answer the aff's arguments", () => {
    const text = constructRoundPlanInstructions(plan, "against")
    expect(text).toContain("real competitive policy debater")
    expect(text).toContain('"2 off"')
    expect(text).toContain("Spending / Debt DA [disad] — Link: trillions in new spending.")
    expect(text).toContain("Your opponent chose to run:\n1. Uninsured Deaths advantage")
    expect(text).toContain("[1] Single payer costs $32 trillion — Blahous '18")
    expect(text).toContain("Never invent a citation")
  })

  it("has an affirmative bot read the plan and advantages", () => {
    const text = constructRoundPlanInstructions({ ...plan, botArguments: [{ title: "Cost Control advantage" }] }, "for")
    expect(text).toContain("affirmative case")
    expect(text).toContain("read the plan and your advantages")
  })

  it("forbids citations in a round without evidence", () => {
    const text = constructRoundPlanInstructions({ ...plan, evidence: "without", cards: [] }, "against")
    expect(text).toContain("without evidence")
    expect(text).not.toContain("Blahous")
  })

  it("lets the bot pick its own positions when none were ticked", () => {
    expect(constructRoundPlanInstructions({ ...plan, botArguments: [] }, "against")).toContain(
      "Choose the disadvantages, counterplans and case turns",
    )
  })
})

describe("the plan in the bot's prompt", () => {
  const bot = getBotPersonality("Moderate Mike")

  it("is carried into the prompt", () => {
    const prompt = constructPrompt(bot, NATIONAL_HEALTHCARE_TOPIC, [], "against", "Make your statement", 250, "PLAN BLOCK")
    expect(prompt).toContain("Additional context: Make your statement\nPLAN BLOCK")
  })

  it("shows a negative bot the 1AC it is answering in its opening", () => {
    const prompt = constructPrompt(
      bot,
      NATIONAL_HEALTHCARE_TOPIC,
      [{ sender: "User", text: "Plan: single payer. Advantage one: uninsured deaths.", phase: "Opening Statements" }],
      "against",
      "",
      0,
    )
    expect(prompt).toContain("This is the Opening Statement phase")
    expect(prompt).toContain('"Plan: single payer. Advantage one: uninsured deaths."')
  })

  it("maps the round screen's phase names onto their own instructions", () => {
    const history = [
      { sender: "User", text: "1AC", phase: "Opening Statements" },
      { sender: "Bot", text: "1NC", phase: "Opening Statements" },
      { sender: "User", text: "Why does spending cause a crisis?", phase: "Cross-Examination" },
    ]
    expect(constructPrompt(bot, "T", history, "against", "", 0)).toContain("This is the Cross Examination phase")
    expect(
      constructPrompt(bot, "T", [...history, { sender: "User", text: "Vote aff", phase: "Closing Statements" }], "against", "", 0),
    ).toContain("This is the Closing Statement phase")
  })

  it("reaches the model from generateBotResponse", async () => {
    let seen = ""
    const client = createStaticModelClient((prompt) => {
      seen = prompt
      return "Two off. First, the spending DA."
    })
    const reply = await generateBotResponse(client, {
      botName: "Moderate Mike",
      botLevel: "Medium",
      topic: NATIONAL_HEALTHCARE_TOPIC,
      history: [],
      stance: "against",
      plan,
    })
    expect(reply).toBe("Two off. First, the spending DA.")
    expect(seen).toContain("Spending / Debt DA")
  })

  it("keeps a full cross-ex answer that happens to say 'clarify'", async () => {
    const long =
      "Let me clarify the link: single payer adds thirty-two trillion dollars in federal spending over a decade, which pushes the debt past the threshold where interest rates spike, and that crowds out private investment."
    const reply = await generateBotResponse(createStaticModelClient(long), {
      botName: "Moderate Mike",
      botLevel: "Medium",
      topic: "T",
      history: [],
      stance: "against",
    })
    expect(reply).toBe(long)
  })
})

describe("prep with the preset", () => {
  const input = { botName: "Moderate Mike", botLevel: "Medium", topic: NATIONAL_HEALTHCARE_TOPIC, stance: "for" }

  it("falls back to the preset's default arguments when there are no cards", () => {
    const brief = buildFallbackCaseBrief(input, [])
    expect(brief.yourArguments.map((a) => a.claim)).toContain("Uninsured Deaths advantage")
    expect(brief.opponentArguments.map((a) => a.claim)).toContain("Spending / Debt DA")
    expect(brief.summary).toMatch(/single-payer/i)
  })

  it("names the plan and the topic's common positions in the prep prompt", () => {
    const prompt = constructCasePrepPrompt({ ...input, evidence: "without" }, [], [])
    expect(prompt).toContain("The affirmative's plan:")
    expect(prompt).toContain("- Politics DA [disad, Against]")
    expect(prompt).toContain("debated without evidence")
  })
})
