/**
 * @fileoverview The `/practice/rules` page body: a one-page reference for the common
 * high-school debate formats, their key round sections, and the research,
 * evidence, device/AI and format-specific rules students need to know.
 *
 * The copy is NSDA-style and deliberately general — the notice at the top
 * tells readers that a tournament's own invitation always wins. Content is
 * kept as data below so each section renders from one shape.
 *
 * @module components/rules/FormatsRulesGuide
 */

import type { ReactNode } from "react"

import { cn } from "../../lib/ui/lib/utils"

const SECTIONS = [
  { id: "formats", label: "Formats" },
  { id: "research", label: "Research rules" },
  { id: "evidence", label: "Evidence rules" },
  { id: "devices", label: "Devices & AI" },
  { id: "format-rules", label: "Rules by format" },
  { id: "checklist", label: "Checklist" },
]

const FORMATS: { eyebrow: string; title: string; summary: string; parts: [string, string][] }[] = [
  {
    eyebrow: "Two-person teams",
    title: "Policy Debate (CX)",
    summary:
      "A policy-resolution event built around detailed research, comparative consequences, and technical argument interaction.",
    parts: [
      ["1AC", "plan, advantages, and evidence"],
      ["Negative", "disadvantages, counterplans, topicality, kritik, and case debate"],
      ["Rebuttals", "collapse to decisive voting issues"],
    ],
  },
  {
    eyebrow: "Individual",
    title: "Lincoln-Douglas (LD)",
    summary: "A value-judgment debate centered on ethics, philosophy, frameworks, and direct comparison of principles.",
    parts: [
      ["Framework", "value and standard"],
      ["Contentions", "reasons to affirm or negate"],
      ["Rebuttals", "answer, weigh, and crystallize"],
    ],
  },
  {
    eyebrow: "Two-person teams",
    title: "Public Forum (PF)",
    summary: "A current-events debate designed for accessible, evidence-based persuasion and clear impact comparison.",
    parts: [
      ["Constructives", "introduce contentions"],
      ["Crossfires", "direct questioning"],
      ["Summary / final focus", "narrow and weigh the ballot story"],
    ],
  },
  {
    eyebrow: "Individual chamber",
    title: "Congressional Debate",
    summary:
      "A legislative simulation where delegates debate bills and resolutions through repeated floor speeches and questions.",
    parts: [
      ["Authorship", "open and explain legislation"],
      ["Floor speeches", "affirmative and negative advocacy"],
      ["Procedure", "questioning, motions, amendments, voting"],
    ],
  },
  {
    eyebrow: "Individual",
    title: "Big Questions (BQ)",
    summary: "A research debate connecting science, ethics, and philosophy; clarity and source quality matter heavily.",
    parts: [
      ["Definitions", "frame the question"],
      ["Contentions", "empirical and ethical claims"],
      ["Weighing", "compare evidence, implications, and principles"],
    ],
  },
  {
    eyebrow: "Teams",
    title: "World Schools / Parliamentary / BP",
    summary:
      "Motion-based formats emphasizing fast analysis, direct refutation, teamwork, and persuasive comparative argument.",
    parts: [
      ["Case", "define and defend the motion"],
      ["POIs", "brief questions in many variants"],
      ["Replies / whips", "summarize clash and comparative reasons to win"],
    ],
  },
]

const RESEARCH_RULES: [string, string][] = [
  [
    "Use authoritative, traceable sources",
    "Evidence is a fact, statistic, or example attributed to a specific, identifiable, authoritative source. Unattributed claims are your own arguments—not evidence.",
  ],
  [
    "Keep source context",
    "Save the original article, PDF, webpage, or relevant pages with surrounding text. A quote should not be separated from context that changes its meaning.",
  ],
  [
    "Build complete citations",
    "Record author/editor, publication date, outlet, article title, URL, access date, qualifications when available, and page numbers when available.",
  ],
  [
    "Test every evidence card",
    "Ensure the highlighted language proves the precise claim in the tag. Separate the author’s conclusion from your own inference.",
  ],
]

const EVIDENCE_TABLE: [string, string][] = [
  [
    "Oral citation",
    "When introducing evidence, state at minimum the primary author’s last name and the publication year. For later quotations from the same source, the author name can be sufficient.",
  ],
  [
    "Written citation",
    "Be ready to provide the complete citation upon request, including author, date, source/outlet, title, digital access date, URL if applicable, qualifications, and page numbers if available.",
  ],
  [
    "Mark what is read",
    "Identify evidence orally with a pause or phrase such as “mark the card,” and visibly mark the exact text read or paraphrased in the written document.",
  ],
  [
    "Paraphrasing",
    "A paraphrase must be as accurate and citable as a direct quotation. You must be able to produce the original and identify the supporting passage.",
  ],
  [
    "Evidence exchange",
    "Any evidence, case, or citation used in the round must be made available promptly to an opponent or judge who requests it, in a readable format.",
  ],
]

const EVIDENCE_VIOLATIONS: [string, string][] = [
  ["Distortion", "Never add or delete words in a way that materially changes an author’s conclusion. Bracket words you add."],
  [
    "Nonexistent evidence",
    "Never cite material you cannot produce, text missing from the source, or a paraphrase without a verifiable original.",
  ],
  ["Clipping", "Do not skip words while representing that you read all highlighted or underlined text."],
  [
    "Ellipses & straw arguments",
    "Do not use prohibited internal ellipses, and do not attribute an author’s description of another view to the author as their own position.",
  ],
]

const DEVICE_RULES: [string, string][] = [
  [
    "Allowed uses under current NSDA-style rules",
    "Internet-enabled devices can generally be used to retrieve files, exchange evidence or arguments, conduct research, and communicate with a debate partner.",
  ],
  [
    "No outside competitive assistance",
    "Do not obtain arguments, strategic advice, cross-examination questions, or other competitive help from coaches, non-competing students, or any non-participant during the round.",
  ],
  [
    "You own the tech risk",
    "Bring your own device, power, accessories, and backup plan. Connection or equipment failures typically do not earn extra speaking or prep time.",
  ],
  [
    "Generative AI",
    "Follow the event’s specific AI policy. Do not assume AI is permitted simply because internet research is permitted, and never use it for prohibited real-time outside help.",
  ],
]

const FORMAT_RULES: { title: string; badge: string; summary: string; cards: { title: string; items: string[] }[] }[] = [
  {
    title: "Policy Debate (CX)",
    badge: "Two-person teams",
    summary:
      "Policy debate asks whether the affirmative plan should be adopted. It rewards clean organization, evidence comparison, and direct responses across a long speech sequence.",
    cards: [
      {
        title: "Key round sections",
        items: [
          "Affirmative presents a plan, advantages, and evidence in the 1AC.",
          "Negative answers with case arguments, disadvantages, counterplans, topicality, and/or kritiks.",
          "Cross-examination clarifies evidence and commits opponents to positions.",
          "Rebuttals must prioritize the arguments that decide the ballot.",
        ],
      },
      {
        title: "Evidence & procedure",
        items: [
          "Evidence read must be shareable upon request.",
          "Track arguments on the flow and answer claims in the appropriate later speeches.",
          "Use the team’s prep time carefully; tournament timing rules control.",
          "Do not receive outside coaching or strategic help during the round.",
        ],
      },
    ],
  },
  {
    title: "Lincoln-Douglas Debate (LD)",
    badge: "Individual",
    summary:
      "LD uses a value-judgment resolution. Debaters compare ethical frameworks as well as practical outcomes and empirical claims.",
    cards: [
      {
        title: "Key round sections",
        items: [
          "Affirmative constructive: framework and contentions.",
          "Negative constructive: counter-framework and offense.",
          "Cross-examination: clarify definitions and expose contradictions.",
          "Rebuttals: answer, weigh, and explain the decisive framework.",
        ],
      },
      {
        title: "Core rules",
        items: [
          "The resolution requires a value judgment.",
          "At NSDA-style competition, each contestant debates both sides across the tournament.",
          "Standard sequence: AC 6, NCX 3, NC 7, ACX 3, AR 4, NR 6, AR 3; 4 minutes prep per debater.",
          "Evidence and device rules follow the shared standards above.",
        ],
      },
    ],
  },
  {
    title: "Public Forum Debate (PF)",
    badge: "Two-person teams",
    summary:
      "PF emphasizes an accessible case, direct questioning, and a clear explanation of why a citizen judge should vote for one side.",
    cards: [
      {
        title: "Key round sections",
        items: [
          "Constructives present each side’s contentions and evidence.",
          "Crossfires permit direct questioning and clarification.",
          "Summaries identify the important contested issues and begin weighing.",
          "Final focus gives the concise ballot story.",
        ],
      },
      {
        title: "Core rules",
        items: [
          "Formal plans and counterplans are not permitted; teams should advocate pro or con through reasons, though generalized practical solutions are allowed.",
          "Oral prompting while a speaker has the floor is discouraged and may be penalized.",
          "NSDA-style sequence: 4–4 constructives, 3 crossfire, 4–4 rebuttals, 3 crossfire, 3–3 summaries, 3 grand crossfire, 2–2 final focus; 3 minutes prep per team.",
          "Partners may consult when they do not have the floor and during grand crossfire.",
        ],
      },
    ],
  },
  {
    title: "Congressional Debate",
    badge: "Individual chamber",
    summary:
      "Congress simulates legislative deliberation. Delegates combine research, responsive speeches, questioning, procedure, and civility.",
    cards: [
      {
        title: "Recognition & speeches",
        items: [
          "Recognition follows precedence/recency: not yet spoken, fewer speeches, then least recently spoken.",
          "Authorship/sponsorship and the first negative receive up to 3 minutes plus 2 minutes of questions.",
          "Later speeches are up to 3 minutes with 1 minute of questioning.",
          "Direct questioning is used at national and district competition; recognized questioners have up to 30 seconds.",
        ],
      },
      {
        title: "Procedure & evidence",
        items: [
          "Amendments must be written, identify the relevant lines/clauses, and be germane to the legislation’s intent.",
          "Major votes are counted; presiding-officer elections use secret ballots.",
          "Evidence is verifiable. When challenged, provide requested evidence, citation, or original source within two speeches.",
          "Visual aids may be allowed, but cannot require electronic retrieval devices in the chamber.",
        ],
      },
    ],
  },
  {
    title: "Big Questions Debate (BQ)",
    badge: "Individual",
    summary:
      "BQ explores large questions where science, ethics, and philosophy overlap. The strongest speeches make complex research understandable and comparable.",
    cards: [
      {
        title: "Key round sections",
        items: [
          "Define essential terms and frame the central question.",
          "Present empirical, ethical, and/or philosophical contentions.",
          "Use questioning to test methodology, causation, definitions, and implications.",
          "Weigh the strongest evidence and the most important principles or consequences.",
        ],
      },
      {
        title: "Core rules",
        items: [
          "Use the same shared evidence, citation, availability, and device standards described above.",
          "Clearly distinguish scientific findings from moral conclusions or policy inferences.",
          "Be ready to explain technical claims in language the judge can evaluate.",
          "Check the tournament invitation for the current topic, timing, and event-specific procedures.",
        ],
      },
    ],
  },
  {
    title: "World Schools, Parliamentary & British Parliamentary",
    badge: "Motion-based team formats",
    summary:
      "These formats use different speaker orders by league, but they share a focus on short preparation, clear motion analysis, direct clash, and comparative persuasion.",
    cards: [
      {
        title: "Key round sections",
        items: [
          "Opening government/affirmative defines and defends the motion.",
          "Opposition directly refutes and offers a competing account of the motion.",
          "Later speeches extend the team case rather than merely repeat it.",
          "Reply or whip speeches compare the central clashes and explain the winning side.",
        ],
      },
      {
        title: "Core rules to confirm locally",
        items: [
          "Speaker times, preparation time, points of information, and new-matter limits vary by circuit.",
          "In BP, closing teams must make a distinct, relevant extension and whips generally do not introduce new substantive material.",
          "In World Schools and many parliamentary variants, points of information are brief questions offered during substantive speeches.",
          "Always check the invitation for evidence, electronic-device, and source-citation expectations.",
        ],
      },
    ],
  },
]

const CHECKLIST = [
  "Read the current invitation and confirm the event’s timing, topic, procedures, evidence rules, and AI policy.",
  "Verify every card: correct tag, complete citation, accurate highlighting, and saved original context.",
  "Download or locally save sources and prepare a fast, readable method for sharing evidence.",
  "Bring charging equipment, a backup copy of files, and a backup timing plan.",
  "Do not contact or accept in-round help from non-participants.",
  "Ask procedural questions before the round begins whenever possible.",
]

export function FormatsRulesGuide() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        <nav aria-label="Guide navigation" className="flex flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="rounded-full border border-border bg-card px-3 py-1 text-sm text-foreground transition-colors hover:border-primary hover:text-primary"
            >
              {s.label}
            </a>
          ))}
        </nav>
        <Callout tone="notice">
          <strong>Important:</strong> This is a practical NSDA-style guide. Tournament invitations, state associations, and
          local leagues may use different speech times, procedures, internet rules, or AI policies. Always follow the rules
          governing your specific tournament.
        </Callout>
      </div>

      <Section id="formats" title="Formats at a glance">
        <CardGrid>
          {FORMATS.map((f) => (
            <Card key={f.title}>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-primary">{f.eyebrow}</p>
              <h3 className="text-base font-semibold text-foreground">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.summary}</p>
              <BulletList
                items={f.parts.map(([label, text]) => (
                  <>
                    <strong className="text-foreground">{label}:</strong> {text}
                  </>
                ))}
              />
            </Card>
          ))}
        </CardGrid>
      </Section>

      <Section id="research" title="Research rules">
        <TitledCards cards={RESEARCH_RULES} />
        <Callout tone="tip" label="Recommended workflow:">
          Save the source → create the citation → write a precise tag → highlight only what you will read → preserve nearby
          context → verify the card against its tag → keep a shareable copy ready for the round.
        </Callout>
      </Section>

      <Section id="evidence" title="Evidence & citation rules">
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-muted/60">
                <th className="px-4 py-3 font-semibold text-primary">Rule</th>
                <th className="px-4 py-3 font-semibold text-primary">What to do in practice</th>
              </tr>
            </thead>
            <tbody>
              {EVIDENCE_TABLE.map(([rule, practice]) => (
                <tr key={rule} className="border-t border-border align-top">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">{rule}</td>
                  <td className="px-4 py-3 text-muted-foreground">{practice}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TitledCards cards={EVIDENCE_VIOLATIONS} />
        <Callout tone="tip" label="Consequences:">
          Minor citation or marking issues may cause judges to disregard or discount evidence. Serious violations—such as
          clipping, distortion, or nonexistent evidence—can cause a loss, zero speaker points, disqualification, or further
          tournament sanctions.
        </Callout>
      </Section>

      <Section id="devices" title="Devices, internet & AI">
        <TitledCards cards={DEVICE_RULES} />
      </Section>

      <Section id="format-rules" title="Rules by format">
        {FORMAT_RULES.map((f) => (
          <article key={f.title} className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline gap-3">
              <h3 className="text-xl font-semibold text-foreground">{f.title}</h3>
              <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">{f.badge}</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{f.summary}</p>
            <CardGrid className="mt-4">
              {f.cards.map((c) => (
                <div key={c.title} className="rounded-xl border border-border bg-background p-4">
                  <h4 className="text-sm font-semibold text-foreground">{c.title}</h4>
                  <BulletList items={c.items} />
                </div>
              ))}
            </CardGrid>
          </article>
        ))}
      </Section>

      <Section id="checklist" title="Pre-round checklist">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-foreground marker:font-semibold marker:text-primary">
          {CHECKLIST.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
        <Callout tone="tip" label="Best habit:">
          Treat every evidence card as if an opponent will request it immediately. If you can quickly show the complete
          source, exact passage, and accurate citation, you are ready to read it.
        </Callout>
      </Section>

      <p className="text-xs text-muted-foreground">
        This guide combines debate-format summaries with research and competition rules reflected in NSDA-style tournament
        material. Tournament-specific rules take priority whenever they differ.
      </p>
    </div>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-4 flex-col gap-4">
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
      {children}
    </section>
  )
}

function CardGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>{children}</div>
}

function Card({ children }: { children: ReactNode }) {
  return <article className="rounded-xl border border-border bg-card p-5 shadow-sm">{children}</article>
}

function TitledCards({ cards }: { cards: [string, string][] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {cards.map(([title, body]) => (
        <Card key={title}>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
        </Card>
      ))}
    </div>
  )
}

function BulletList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground marker:text-primary">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  )
}

function Callout({ tone, label, children }: { tone: "notice" | "tip"; label?: string; children: ReactNode }) {
  return (
    <aside
      className={cn(
        "rounded-r-xl border border-l-4 border-border px-4 py-3 text-sm",
        tone === "notice"
          ? "border-l-amber-500 bg-amber-500/10 text-foreground"
          : "border-l-emerald-500 bg-emerald-500/10 text-muted-foreground",
      )}
    >
      {label ? <strong className="text-emerald-700 dark:text-emerald-400">{label}</strong> : null} {children}
    </aside>
  )
}
