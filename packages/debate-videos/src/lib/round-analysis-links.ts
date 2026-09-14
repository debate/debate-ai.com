/**
 * Explicit pairs of an analysis/infographic recording and the full round it
 * explains.  The analysis descriptions identify these YouTube ids as their
 * “Full Round” links; keeping the relation by id (rather than title text)
 * makes the pairing survive title edits and sorting.
 */
export const ROUND_ANALYSIS_LINKS: Readonly<Record<string, string>> = {
  // 2026 NDT Finals — CSU Long Beach OM v Emory GS
  "DfG4qeHIU9M": "T77G1CdZx9E",
  // 2022 NDT Finals — Dartmouth SV v Michigan PR
  "Afl7_hl-H0c": "qx7Xx_6exzk",
  // 2015 NDT Finals — Northwestern MV v Michigan AP
  "rXAfSFKvMJY": "zoKowWVQ1wE",
};

/** Returns the other member of a deliberately linked round pair. */
export function linkedRoundVideoId(videoId: string): string | undefined {
  const direct = ROUND_ANALYSIS_LINKS[videoId];
  if (direct) return direct;
  return Object.entries(ROUND_ANALYSIS_LINKS).find(([, roundId]) => roundId === videoId)?.[0];
}
