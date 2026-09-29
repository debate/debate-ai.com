/**
 * @fileoverview The CARDS overview — the mission statement, capabilities and
 * seven-point vision that used to fill `/cards`'s empty state — as data the
 * features page renders in its "CARDS vision" section.
 *
 * `/cards` now opens on a short prompt that links here, so this copy has one
 * home in the app. The long-form docs page
 * (`debate-help-docs` `content/docs/features/cards.mdx`) carries the same text.
 *
 * @module features/cards-vision
 */

/** The acronym's expansion, shown as the section's eyebrow. */
export const CARDS_TITLE = "Crowdsourced Annotated Research for Debating Solutions (CARDS)";

/** The mission statement. */
export const CARDS_OVERVIEW =
  "Critical times call for critical thinkers to create a crowdsourced annotated research dataset, for AI models to recommend research quotes, to evolve crowdsourced chain-of-thought reasoning, unlock faster ways to read long articles, to monitor developments in a knowledge graph by topic modeling, and to provide a public service of answers to research. Debate should be a war of warrants where victories are vectorized as weights — weights which lead to the emergence of Collective Consciousness.";

/** What the CARDS search does today. */
export const CARDS_CAPABILITIES = [
  "Search within summaries, cites, highlighted and full text over millions of research quotes.",
  "Scout what evidence selected teams and schools frequently read.",
  "Sort by Speeches Read In Count (statistics from over a decade in all styles).",
  "Use Words Bold & Highlighted to match speech times (~300 w/min) and to read aloud warranted summaries while judge & opponents reads highlighted quotes on-screen, which makes context more understandable and publically persuasive.",
  "Collaborate on topic outlines, share evidence, and download Topic Starter outlines.",
];

/** A Zenodo DOI badge for a published CARDS dataset or paper. */
export interface CardsDoi {
  /** The DOI's resolver URL. */
  href: string;
  /** Zenodo's badge image for that DOI. */
  badge: string;
}

/** DOIs for the published CARDS datasets and papers. */
export const CARDS_DOIS: CardsDoi[] = ["20574318", "22170412", "21881743"].map((id) => ({
  href: `https://doi.org/10.5281/zenodo.${id}`,
  badge: `https://zenodo.org/badge/DOI/10.5281/zenodo.${id}.svg`,
}));

/** One numbered point of the vision. */
export interface CardsVisionPoint {
  /** The point's heading, without its number. */
  title: string;
  /** One or more paragraphs. */
  paragraphs: string[];
}

/** The seven-point vision, in order. */
export const CARDS_VISION: CardsVisionPoint[] = [
  {
    title: "The Debate Singularity is Happening",
    paragraphs: [
      "AI now researches topics in depth, highlights key quotes, frames both sides of arguments, coaches preparation, exposes flaws in evidence cards, and crafts strategic closing speeches that compare competing claims. Integrating AI into debate unlocks the next stage of emergent complexity in socio-political governance.",
    ],
  },
  {
    title: "Collective Thought Engine",
    paragraphs: [
      "Language Models can distill collective thought into a vector space where every point carries a weighted value, reflecting its contribution to decision-making. This collective AI consciousness can synthesize complex arguments, judge their validity and relevance, and support a democratic, AI-mediated economy where public votes reward influence and insight.",
      "AI agents learn which arguments and sources persuade different audiences. Crowdsourced automation enables AI to organize argument outlines—much like GitHub's reusable code model—helping it evaluate complex decisions with greater depth and consistency.",
    ],
  },
  {
    title: "Transparent Reasoning",
    paragraphs: [
      "AI reveals the exact sentences and citations behind its reasoning, allowing users to verify alignment with collective interests through sentence-by-sentence interpretability.",
      "Debate Garden aggregates perspectives across the ideological spectrum, highlighting the most persuasive arguments on every side of an issue. As public trust in media and institutional expertise has declined, achieving genuine neutrality requires presenting all viewpoints — not just the mainstream consensus. Rather than offering reductive caricatures of opposing positions, this platform equips users with the strongest, most rigorously reasoned arguments available.",
    ],
  },
  {
    title: "Outcome Simulation Trees",
    paragraphs: [
      "Users can engage in multiple AI-powered practice rounds that map trees of possible outcomes and responses, surfacing the most persuasive strategies across diverse contexts.",
    ],
  },
  {
    title: "Outlines of Current News Issues",
    paragraphs: [
      "Each debate card fits into a broader narrative—a topic tree linking evidence, assumptions, and values within a collective framework. This transformation shifts debate from isolated rounds to a shared model of research crowdsourced to the public by a few thousand editors, like Wikipedia or Github.",
    ],
  },
  {
    title: "Solving Post-Self Alignment",
    paragraphs: [
      "Recognizing the interconnectedness of research articles mirrors how we should relate to global citizens as part of an emergent collective consciousness. Losing sight of that bigger picture fuels bias, tribalism, and division at the root of modern conflicts between isolated social news bubbles. Only by mapping the whole internet as a debate outline enables seeing how each idea fits into a whole greater than the sum of its parts. This sets a socio-political model to build synergistic consciousness ethical awareness across both discourse and institutional governance. This can reduce LLM hallucination and steer alignment with common social values as AI gains capacity to replace human leaders of organizations.",
    ],
  },
  {
    title: "Topic Research Unified Tree Hierarchy (TRUTH)",
    paragraphs: [
      "Key metadata extracted for LLM analysis allows models to detect logic flaws, flag overstatements, strengthen warrants, and place each claim within the Topic Research Unified Tree Hierarchy (TRUTH). This consensus-driven system seeks grounded truth, reduces hallucination, and aligns AI reasoning with shared human values—laying groundwork for responsible AI governance.",
    ],
  },
];
