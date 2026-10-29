/**
 * @fileoverview The round plan: which topic is debated, whether evidence is
 * used, and which arguments each side chose to run — plus the topic presets
 * that seed those choices and the prompt block that turns a plan into
 * real-round strategy for the bot.
 *
 * The default preset is the current high-school policy topic (national
 * health insurance) with a single-payer affirmative, so a debater can open
 * the page and practise straight away: the aff reads single payer and its
 * advantages, the neg runs the disads, counterplans and T a real 1NC would.
 *
 * Not a Go port; upstream `arguehub` had no notion of a case or of chosen
 * arguments. Plain data and string building, so it runs on a Worker.
 *
 * @module backend/round-plan
 */

import type { EvidenceMode, RoundArgument, RoundEvidenceCard, RoundPlan } from "./types"

/** A preset argument: a `RoundArgument` with a stable id for the picker. */
export interface PresetArgument extends RoundArgument {
  id: string
  title: string
  summary: string
  kind: "advantage" | "disad" | "counterplan" | "kritik" | "topicality" | "case"
}

/** A topic the wizard offers with ready-made arguments for both sides. */
export interface TopicPreset {
  id: string
  /** Short label for the picker. */
  label: string
  /** The resolution as debated. */
  topic: string
  /** The default affirmative plan, when the topic has one. */
  affPlan?: string
  /** Arguments the affirmative ("For") side can run. */
  affArguments: PresetArgument[]
  /** Arguments the negative ("Against") side can run. */
  negArguments: PresetArgument[]
  /** Arguments selected by default on each side. */
  defaultAff: string[]
  defaultNeg: string[]
}

/** The 2026-27 high-school policy resolution (`vcx27`, National Health Insurance). */
export const NATIONAL_HEALTHCARE_TOPIC =
  "Resolved: The United States federal government should establish national health insurance in the United States."

export const SINGLE_PAYER_PLAN =
  "The United States federal government should establish a single-payer national health insurance program covering all residents, funded through federal taxes, replacing private insurance for essential benefits (Medicare for All)."

export const NATIONAL_HEALTHCARE_PRESET: TopicPreset = {
  id: "national-healthcare",
  label: "National health insurance (current policy topic)",
  topic: NATIONAL_HEALTHCARE_TOPIC,
  affPlan: SINGLE_PAYER_PLAN,
  affArguments: [
    {
      id: "uninsured-deaths",
      kind: "advantage",
      title: "Uninsured Deaths advantage",
      summary:
        "Tens of millions are uninsured or underinsured; lack of coverage delays care and causes tens of thousands of preventable deaths a year. Single payer covers everyone, so the aff saves lives now.",
    },
    {
      id: "cost-control",
      kind: "advantage",
      title: "Cost Control advantage",
      summary:
        "Administrative waste and fragmented bargaining drive U.S. spending far above peer nations. A single payer cuts billing overhead and negotiates drug prices, bending the cost curve and freeing household income.",
    },
    {
      id: "medical-bankruptcy",
      kind: "advantage",
      title: "Economy / Medical Debt advantage",
      summary:
        "Medical debt is a leading cause of bankruptcy and job lock keeps workers from moving or starting businesses. Decoupling coverage from employment boosts labor mobility, entrepreneurship and growth.",
    },
    {
      id: "pandemic-preparedness",
      kind: "advantage",
      title: "Pandemic Preparedness advantage",
      summary:
        "Uninsured people avoid testing and treatment, letting outbreaks spread. Universal coverage gives a unified surveillance and response system that contains the next pandemic.",
    },
    {
      id: "health-equity",
      kind: "advantage",
      title: "Health Equity advantage",
      summary:
        "Coverage gaps fall hardest on low-income and minority communities, entrenching disparities in maternal and chronic care. Universal coverage closes those gaps.",
    },
    {
      id: "aff-answers-spending",
      kind: "case",
      title: "Answers to the spending DA",
      summary:
        "Total national health spending falls under single payer; new taxes replace premiums people already pay, so there is no net drain and no link to a debt crisis.",
    },
  ],
  negArguments: [
    {
      id: "spending-da",
      kind: "disad",
      title: "Spending / Debt DA",
      summary:
        "Uniqueness: deficits are stable enough for now. Link: single payer adds trillions in federal spending. Internal link: debt spikes raise interest rates and crowd out investment. Impact: fiscal crisis and recession, which collapses growth and hegemony.",
    },
    {
      id: "politics-da",
      kind: "disad",
      title: "Politics DA",
      summary:
        "Uniqueness: a key bill is on track to pass. Link: forcing single payer is a massive fight that drains the president's political capital. Impact: the bill fails, triggering the scenario that bill prevents.",
    },
    {
      id: "innovation-da",
      kind: "disad",
      title: "Pharma Innovation DA",
      summary:
        "Uniqueness: U.S. drug margins fund most global R&D. Link: a single buyer slashes prices and profits. Impact: R&D investment collapses, slowing cures and leaving us unprepared for future pandemics.",
    },
    {
      id: "hospitals-da",
      kind: "disad",
      title: "Rural Hospitals DA",
      summary:
        "Uniqueness: rural hospitals are barely solvent on private-insurance margins. Link: paying everything at Medicare rates cuts their revenue. Impact: closures create care deserts and raise rural mortality, turning the uninsured-deaths advantage.",
    },
    {
      id: "insurance-jobs-da",
      kind: "disad",
      title: "Insurance Jobs / Economy DA",
      summary:
        "Link: eliminating private insurance wipes out hundreds of thousands of jobs in insurers and billing. Impact: a labor-market shock and lost tax base that harms the same families the aff wants to help.",
    },
    {
      id: "states-cp",
      kind: "counterplan",
      title: "States CP",
      summary:
        "The fifty states establish single-payer coverage instead. Solves the aff's coverage advantages while avoiding the federal spending and politics links.",
    },
    {
      id: "public-option-cp",
      kind: "counterplan",
      title: "ACA Expansion / Public Option CP",
      summary:
        "Expand ACA subsidies and add a public option rather than abolishing private insurance. Captures most of the coverage gains while avoiding the innovation and jobs disads.",
    },
    {
      id: "wait-times",
      kind: "case",
      title: "Wait Times case turn",
      summary:
        "Single-payer systems ration care through queues; Canada and the UK show long waits for specialists and surgery, so the aff can increase deaths rather than prevent them.",
    },
    {
      id: "establish-t",
      kind: "topicality",
      title: "T: 'establish'",
      summary:
        "'Establish' means to create something new; if the aff only expands an existing program, it is not topical and explodes the limits of the topic.",
    },
  ],
  defaultAff: ["uninsured-deaths", "cost-control", "medical-bankruptcy"],
  defaultNeg: ["spending-da", "politics-da", "innovation-da", "hospitals-da"],
}

/** Topics with ready-made arguments, the default first. */
export const TOPIC_PRESETS: TopicPreset[] = [NATIONAL_HEALTHCARE_PRESET]

/** The topic the wizard opens on. */
export const DEFAULT_PRACTICE_TOPIC = NATIONAL_HEALTHCARE_TOPIC

/** The preset for a topic, matched case- and space-insensitively, or `null` for a custom topic. */
export function findTopicPreset(topic: string): TopicPreset | null {
  const key = topic.trim().toLowerCase().replace(/\s+/g, " ")
  return TOPIC_PRESETS.find((p) => p.topic.toLowerCase() === key) ?? null
}

/** A preset's arguments for one side ("for"/"against", any case). */
export function presetArgumentsFor(preset: TopicPreset, stance: string): PresetArgument[] {
  return stance.toLowerCase() === "against" ? preset.negArguments : preset.affArguments
}

/** The ids a preset selects by default for one side. */
export function defaultPresetSelection(preset: TopicPreset, stance: string): string[] {
  return stance.toLowerCase() === "against" ? preset.defaultNeg : preset.defaultAff
}

export const MAX_PLAN_ARGUMENTS = 8
export const MAX_PLAN_CARDS = 12

const clip = (value: unknown, max: number): string => (typeof value === "string" ? value.trim().slice(0, max) : "")

function sanitizeArguments(value: unknown): RoundArgument[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((a): a is Record<string, unknown> => typeof a === "object" && a !== null)
    .map((a) => ({
      title: clip(a.title, 200),
      summary: clip(a.summary, 600) || undefined,
      kind: clip(a.kind, 24) || undefined,
    }))
    .filter((a) => a.title)
    .slice(0, MAX_PLAN_ARGUMENTS)
}

function sanitizeCards(value: unknown): RoundEvidenceCard[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
    .map((c) => ({
      tag: clip(c.tag, 300),
      cite: clip(c.cite, 300) || undefined,
      excerpt: clip(c.excerpt, 500) || undefined,
    }))
    .filter((c) => c.tag)
    .slice(0, MAX_PLAN_CARDS)
}

/** Keep only a well-formed plan, every field clipped, so a client can't send an unbounded prompt. */
export function sanitizeRoundPlan(plan: unknown): RoundPlan | null {
  if (typeof plan !== "object" || plan === null) return null
  const record = plan as Record<string, unknown>
  const evidence: EvidenceMode = record.evidence === "without" ? "without" : "with"
  return {
    evidence,
    affPlan: clip(record.affPlan, 600) || undefined,
    userArguments: sanitizeArguments(record.userArguments),
    botArguments: sanitizeArguments(record.botArguments),
    cards: evidence === "with" ? sanitizeCards(record.cards) : [],
  }
}

const argumentLines = (args: RoundArgument[]): string =>
  args.map((a, i) => `${i + 1}. ${a.title}${a.kind ? ` [${a.kind}]` : ""}${a.summary ? ` — ${a.summary}` : ""}`).join("\n")

/**
 * The prompt block that makes the bot debate like a competitor: run the
 * chosen positions, answer the debater's actual arguments line by line, and
 * cite only real cards. `botStance` is the bot's own side ("for"/"against").
 */
export function constructRoundPlanInstructions(plan: RoundPlan, botStance: string): string {
  const botIsAff = botStance.toLowerCase() !== "against"
  const lines: string[] = [
    "Debate the way a real competitive policy debater would in a tournament round, not like an essay or a chatbot:",
    "- Signpost every argument so it can be flowed (\"On the spending DA…\", \"Their first advantage…\").",
    "- Disads run uniqueness, link, internal link and impact; advantages run inherency/harms, solvency and impact. Name each part briefly.",
    "- Do impact calculus: compare magnitude, probability and timeframe, and explain why your impacts outweigh.",
    "- Answer the opponent's specific arguments line by line; call out anything they dropped and extend your own positions by name.",
    "- In cross-examination, ask short, pointed questions that set up your arguments; answer questions directly without dodging.",
    "- Use the vocabulary real debaters use (turns, non-uniques, no-link, perm, solvency deficit, outweighs) where it fits.",
  ]

  if (plan.affPlan) {
    lines.push(`The affirmative's plan: ${plan.affPlan}`)
  }

  if (plan.botArguments.length) {
    lines.push(
      `Your positions (${botIsAff ? "affirmative case" : "the off-case and case arguments you run"}):\n${argumentLines(plan.botArguments)}`,
    )
    lines.push(
      botIsAff
        ? "In your opening, read the plan and your advantages. Later, defend them and answer every negative position."
        : `In your opening, announce how many off-case positions you are reading ("${plan.botArguments.length} off") and read each one; then go to the case. Later, extend your strongest disads and weigh them against the aff.`,
    )
  } else {
    lines.push(
      botIsAff
        ? "Choose a plan and two or three advantages a strong affirmative would run on this topic."
        : "Choose the disadvantages, counterplans and case turns a strong negative would run against this affirmative.",
    )
  }

  if (plan.userArguments.length) {
    lines.push(`Your opponent chose to run:\n${argumentLines(plan.userArguments)}\nPrepare specific answers to each of these.`)
  }

  if (plan.evidence === "with" && plan.cards?.length) {
    const cardLines = plan.cards
      .map((c, i) => `[${i + 1}] ${c.tag}${c.cite ? ` — ${c.cite}` : ""}${c.excerpt ? `\n    "${c.excerpt}"` : ""}`)
      .join("\n")
    lines.push(
      `This is an evidence round. Support your claims with these cards, citing the author and year as debaters do ("Smith '24 says…"):\n${cardLines}\nNever invent a citation that isn't listed; argue analytically where no card fits.`,
    )
  } else if (plan.evidence === "with") {
    lines.push(
      "This is an evidence round, but no cards were found. Refer only to well-known, real studies and sources, and never invent authors, dates or statistics.",
    )
  } else {
    lines.push(
      "This round is without evidence: make analytic arguments from logic, examples and common knowledge. Do not cite or invent authors, studies or statistics.",
    )
  }

  return lines.join("\n")
}
