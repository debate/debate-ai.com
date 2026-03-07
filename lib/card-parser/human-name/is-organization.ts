import { TERMS_ORG, TERMS_QUALIFICATIONS, ORG_PATTERNS } from "./constants";
import dataHumanNames from "./human-names-92k.json";

/**
 * Validates whether a provided name string conceptually applies to a registered organization,
 * corporation, publication, or government entity vs a discrete human.
 *
 * @param {string} nameString - The analyzed string representation.
 * @returns {boolean} `true` if heuristically categorized as an organization.
 */
export function isOrganization(nameString: string): boolean {
  if (!nameString) return false;

  const nameLower = nameString.toLowerCase().replace(/[^\w\s]/g, " ");
  const words = nameLower.split(/\s+/).filter(Boolean);

  // Short rigid acronym block identifies rapid organizations (e.g., NAACP, WHO)
  if (/^[A-Z]{2,6}$/.test(nameString.trim())) {
    return true;
  }

  // Organization dict scan
  for (const word of words) {
    if (TERMS_ORG.has(word)) return true;
  }

  // Qualification dict scan (counter-balance for "Professor Institute ABC")
  for (const word of words) {
    if (TERMS_QUALIFICATIONS.has(word)) return false;
  }

  // Last, First name inversion standard
  if (/,\s*\w+/.test(nameString)) {
    return false;
  }

  // Robust standard organizational lexical phrases match
  for (const pattern of ORG_PATTERNS) {
    if (pattern.test(nameString)) return true;
  }

  // Arbitrary length fail-over. Most humans lack > 4 distinct name elements.
  if (words.length > 4 && !nameString.includes(",")) return true;

  // Cross-reference against our standard known human-names dataset
  const record = dataHumanNames as Record<string, number>;
  const hasHumanNamePart = words.some((word) => {
    const titleCase =
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    return record[titleCase] === 1 || record[titleCase] === 2;
  });

  return !hasHumanNamePart && words.length > 2;
}
