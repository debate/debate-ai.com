/**
 * @fileoverview The CARDS overview — the mission statement, capabilities and
 * condensed vision that the features page renders in its "CARDS vision" section.
 *
 * @module features/cards-vision
 */

/** The acronym's expansion, shown as the section's eyebrow. */
export const CARDS_TITLE = "Crowdsourced Annotated Research for Debating Solutions (CARDS)";

/** The mission statement. */
export const CARDS_OVERVIEW =
  "Critical times call for critical thinkers to build a crowdsourced annotated research dataset so AI can recommend quotes, evolve chain-of-thought reasoning, accelerate reading of long articles, and answer research questions. Debate is a war of warrants where victories are vectorized as weights — weights that give rise to Collective Consciousness.";

/** What the CARDS search does today. */
export const CARDS_CAPABILITIES = [
  "Search summaries, cites, highlights, and full text across millions of research quotes.",
  "Scout top evidence by team and school, sorted by Speeches Read In Count.",
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

/** The condensed vision, in order. */
export const CARDS_VISION: CardsVisionPoint[] = [
  {
    title: "The Debate Singularity & TRUTH",
    paragraphs: [
      "AI now researches topics in depth, highlights key quotes, frames both sides of arguments, coaches preparation, exposes flaws in evidence cards, and crafts strategic closing speeches that compare competing claims. AI-powered practice rounds map trees of possible outcomes, surfacing the most persuasive strategies across diverse contexts.",
      "Key metadata extracted for LLM analysis lets models detect logic flaws, flag overstatements, strengthen warrants, and place each claim within the Topic Research Unified Tree Hierarchy (TRUTH) — a consensus-driven system that seeks grounded truth, reduces hallucination, and aligns AI reasoning with shared human values.",
    ],
  },
  {
    title: "Collective Thought Engine",
    paragraphs: [
      "Language Models distill collective thought into a vector space where every point carries a weighted value, reflecting its contribution to decision-making. This collective AI consciousness can synthesize complex arguments, judge their validity and relevance, and support a democratic, AI-mediated economy where public votes reward influence and insight.",
      "AI agents learn which arguments and sources persuade different audiences. Argument outlines—much like GitHub's reusable code model—link debate cards into topic trees connecting evidence, assumptions, and values within a shared framework crowdsourced by thousands of editors.",
    ],
  },
  {
    title: "Transparent Reasoning",
    paragraphs: [
      "AI reveals the exact sentences and citations behind its reasoning, allowing users to verify alignment with collective interests through sentence-by-sentence interpretability.",
      "Debate Garden aggregates perspectives across the ideological spectrum, highlighting the most persuasive arguments on every side of an issue. Achieving genuine neutrality requires presenting all viewpoints—not just the mainstream consensus—equipping users with the strongest arguments available.",
    ],
  },
  {
    title: "Solving Post-Self Alignment",
    paragraphs: [
      "Recognizing the interconnectedness of research articles mirrors how we should relate to global citizens as part of an emergent collective consciousness. Only by mapping the whole internet as a debate outline can we see how each idea fits into a whole greater than the sum of its parts—setting a socio-political model for synergistic consciousness, ethical awareness, and reduced LLM hallucination.",
    ],
  },
];
