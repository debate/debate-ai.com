/**
 * @fileoverview Tournament logo mappings using school/tournament logos from debate-icons
 */

import type { FC, SVGProps } from "react";
import type { StaticImageData } from "next/image";

// Import school logos that might also be used for tournaments
import IconSchoolHarvard from "../../../../../debate-icons/schools/harvard.png";
import IconSchoolHarvardWestlake from "../../../../../debate-icons/schools/harvard-westlake.png";
import IconSchoolGreenhill from "../../../../../debate-icons/schools/greenhill.png";
import IconSchoolEmory from "../../../../../debate-icons/schools/emory.png";
import IconSchoolGeorgetown from "../../../../../debate-icons/schools/georgetown.png";
import IconSchoolCeda from "../../../../../debate-icons/schools/ceda.png";
import IconSchoolGlenbrookNorth from "../../../../../debate-icons/schools/glenbrook-north.png";
import IconSchoolNorthwestern from "../../../../../debate-icons/schools/northwestern.png";
import IconSchoolWakeForest from "../../../../../debate-icons/schools/wake-forest.png";
import IconSchoolKentucky from "../../../../../debate-icons/schools/kentucky.png";
import IconSchoolMichiganState from "../../../../../debate-icons/schools/michigan-state.png";
import IconSchoolNdt from "../../../../../debate-icons/schools/ndt.png";
import IconSchoolDartmouth from "../../../../../debate-icons/schools/dartmouth.png";
import IconSchoolRedlands from "../../../../../debate-icons/schools/redlands.png";
import IconSchoolStMarks from "../../../../../debate-icons/schools/st-marks-school-of-texas.png";
import IconSchoolWestminster from "../../../../../debate-icons/schools/westminster.png";
import IconSchoolBlake from "../../../../../debate-icons/schools/blake.png";
import IconSchoolHarker from "../../../../../debate-icons/schools/harker.png";
import IconSchoolNdca from "../../../../../debate-icons/schools/ndca.png";
import IconSchoolUcBerkeley from "../../../../../debate-icons/schools/uc-berkeley.png";
import IconSchoolCollegePrep from "../../../../../debate-icons/schools/college-prep.png";
import IconSchoolCsuLongBeach from "../../../../../debate-icons/schools/csu-long-beach.png";
import IconSchoolIowa from "../../../../../debate-icons/schools/iowa.png";
import IconSchoolKansas from "../../../../../debate-icons/schools/kansas.png";
import IconSchoolMarlborough from "../../../../../debate-icons/schools/marlborough.png";
import IconSchoolMichigan from "../../../../../debate-icons/schools/michigan.png";
import IconSchoolMontgomeryBell from "../../../../../debate-icons/schools/montgomery-bell.png";
import IconSchoolNewTrier from "../../../../../debate-icons/schools/new-trier.png";
import IconSchoolStrakeJesuit from "../../../../../debate-icons/schools/strake-jesuit.png";
import IconSchoolTexas from "../../../../../debate-icons/schools/texas.png";
import IconSchoolToc from "../../../../../debate-icons/schools/toc.png";
import IconSchoolWesternKentucky from "../../../../../debate-icons/schools/western-kentucky.png";
import IconSchoolNsda from "../../../../../debate-icons/schools/nsda.png";
import IconSchoolGlenbrookSouth from "../../../../../debate-icons/schools/glenbrook-south.png";
import { getSchoolLogo } from "@debate-ai/rankings/src/leaderboard/lib/schoolLogos";

const slugify = (s: string): string =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const TOURNAMENT_LOGO_MAP: Record<string, string | FC<SVGProps<SVGSVGElement>> | StaticImageData> = {
  harvard: (IconSchoolHarvard as any)?.src ?? (IconSchoolHarvard as any),
  "harvard-national": (IconSchoolHarvard as any)?.src ?? (IconSchoolHarvard as any),
  "harvard-westlake": (IconSchoolHarvardWestlake as any)?.src ?? (IconSchoolHarvardWestlake as any),
  greenhill: (IconSchoolGreenhill as any)?.src ?? (IconSchoolGreenhill as any),
  emory: (IconSchoolEmory as any)?.src ?? (IconSchoolEmory as any),
  "barkley": (IconSchoolEmory as any)?.src ?? (IconSchoolEmory as any),
  "barkley-forum": (IconSchoolEmory as any)?.src ?? (IconSchoolEmory as any),
  "barkley-forum-emory": (IconSchoolEmory as any)?.src ?? (IconSchoolEmory as any),
  georgetown: (IconSchoolGeorgetown as any)?.src ?? (IconSchoolGeorgetown as any),
  ceda: (IconSchoolCeda as any)?.src ?? (IconSchoolCeda as any),
  glenbrooks: (IconSchoolGlenbrookNorth as any)?.src ?? (IconSchoolGlenbrookNorth as any), // often associated with Glenbrook
  "glenbrook-north": (IconSchoolGlenbrookNorth as any)?.src ?? (IconSchoolGlenbrookNorth as any),
  "glenbrook-south": (IconSchoolGlenbrookSouth as any)?.src ?? (IconSchoolGlenbrookSouth as any),
  northwestern: (IconSchoolNorthwestern as any)?.src ?? (IconSchoolNorthwestern as any),
  "wake-forest": (IconSchoolWakeForest as any)?.src ?? (IconSchoolWakeForest as any),
  // The Franklin R. Shirley Classic is Wake Forest's tournament: its logo,
  // with a "Shirley" badge beside it (see getTournamentBadge).
  shirley: (IconSchoolWakeForest as any)?.src ?? (IconSchoolWakeForest as any),
  "franklin-r-shirley": (IconSchoolWakeForest as any)?.src ?? (IconSchoolWakeForest as any),
  "franklin-shirley": (IconSchoolWakeForest as any)?.src ?? (IconSchoolWakeForest as any),
  kentucky: (IconSchoolKentucky as any)?.src ?? (IconSchoolKentucky as any),
  "michigan-state": (IconSchoolMichiganState as any)?.src ?? (IconSchoolMichiganState as any),
  ndt: (IconSchoolNdt as any)?.src ?? (IconSchoolNdt as any),
  "national-debate-tournament": (IconSchoolNdt as any)?.src ?? (IconSchoolNdt as any),
  dartmouth: (IconSchoolDartmouth as any)?.src ?? (IconSchoolDartmouth as any),
  redlands: (IconSchoolRedlands as any)?.src ?? (IconSchoolRedlands as any),
  "st-marks": (IconSchoolStMarks as any)?.src ?? (IconSchoolStMarks as any),
  westminster: (IconSchoolWestminster as any)?.src ?? (IconSchoolWestminster as any),
  blake: (IconSchoolBlake as any)?.src ?? (IconSchoolBlake as any),
  harker: (IconSchoolHarker as any)?.src ?? (IconSchoolHarker as any),
  "ndca": (IconSchoolNdca as any)?.src ?? (IconSchoolNdca as any),
  "national-debate-coaches-association": (IconSchoolNdca as any)?.src ?? (IconSchoolNdca as any),
  "berkeley": (IconSchoolUcBerkeley as any)?.src ?? (IconSchoolUcBerkeley as any),
  "uc-berkeley": (IconSchoolUcBerkeley as any)?.src ?? (IconSchoolUcBerkeley as any),
  "cal": (IconSchoolUcBerkeley as any)?.src ?? (IconSchoolUcBerkeley as any),
  "cal-berkeley": (IconSchoolUcBerkeley as any)?.src ?? (IconSchoolUcBerkeley as any),
  "berkeley-round-robin": (IconSchoolUcBerkeley as any)?.src ?? (IconSchoolUcBerkeley as any),
  "cal-round-robin": (IconSchoolUcBerkeley as any)?.src ?? (IconSchoolUcBerkeley as any),
  "berkeley-forensics": (IconSchoolUcBerkeley as any)?.src ?? (IconSchoolUcBerkeley as any),
  "college-prep": (IconSchoolCollegePrep as any)?.src ?? (IconSchoolCollegePrep as any),
  "csu-long-beach": (IconSchoolCsuLongBeach as any)?.src ?? (IconSchoolCsuLongBeach as any),
  "long-beach": (IconSchoolCsuLongBeach as any)?.src ?? (IconSchoolCsuLongBeach as any),
  "long-beach-state": (IconSchoolCsuLongBeach as any)?.src ?? (IconSchoolCsuLongBeach as any),
  "cal-state-long-beach": (IconSchoolCsuLongBeach as any)?.src ?? (IconSchoolCsuLongBeach as any),
  "iowa": (IconSchoolIowa as any)?.src ?? (IconSchoolIowa as any),
  "university-of-iowa": (IconSchoolIowa as any)?.src ?? (IconSchoolIowa as any),
  "kansas": (IconSchoolKansas as any)?.src ?? (IconSchoolKansas as any),
  "university-of-kansas": (IconSchoolKansas as any)?.src ?? (IconSchoolKansas as any),
  "ku": (IconSchoolKansas as any)?.src ?? (IconSchoolKansas as any),
  "marlborough": (IconSchoolMarlborough as any)?.src ?? (IconSchoolMarlborough as any),
  "michigan": (IconSchoolMichigan as any)?.src ?? (IconSchoolMichigan as any),
  "university-of-michigan": (IconSchoolMichigan as any)?.src ?? (IconSchoolMichigan as any),
  "wolverine": (IconSchoolMichigan as any)?.src ?? (IconSchoolMichigan as any),
  "montgomery-bell": (IconSchoolMontgomeryBell as any)?.src ?? (IconSchoolMontgomeryBell as any),
  "mba": (IconSchoolMontgomeryBell as any)?.src ?? (IconSchoolMontgomeryBell as any),
  "new-trier": (IconSchoolNewTrier as any)?.src ?? (IconSchoolNewTrier as any),
  "strake-jesuit": (IconSchoolStrakeJesuit as any)?.src ?? (IconSchoolStrakeJesuit as any),
  "strake": (IconSchoolStrakeJesuit as any)?.src ?? (IconSchoolStrakeJesuit as any),
  "texas": (IconSchoolTexas as any)?.src ?? (IconSchoolTexas as any),
  "ut-austin": (IconSchoolTexas as any)?.src ?? (IconSchoolTexas as any),
  "longhorn": (IconSchoolTexas as any)?.src ?? (IconSchoolTexas as any),
  "toc": (IconSchoolToc as any)?.src ?? (IconSchoolToc as any),
  nsda: (IconSchoolNsda as any)?.src ?? (IconSchoolNsda as any),
  "nsda-nationals": (IconSchoolNsda as any)?.src ?? (IconSchoolNsda as any),
  "national-speech-debate-association": (IconSchoolNsda as any)?.src ?? (IconSchoolNsda as any),
  "national-speech-and-debate-association": (IconSchoolNsda as any)?.src ?? (IconSchoolNsda as any),
  "tournament-of-champions": (IconSchoolToc as any)?.src ?? (IconSchoolToc as any),
  "western-kentucky": (IconSchoolWesternKentucky as any)?.src ?? (IconSchoolWesternKentucky as any),
  "wku": (IconSchoolWesternKentucky as any)?.src ?? (IconSchoolWesternKentucky as any),
};

/** Tournaments that show a host school's logo plus their own name as a badge. */
const TOURNAMENT_BADGES: { pattern: RegExp; label: string }[] = [
  { pattern: /\bshirley\b/i, label: "Shirley" },
];

/**
 * The short name to badge beside a tournament's logo when the logo alone
 * would name the wrong thing — "Shirley" beside Wake Forest's logo, since the
 * Franklin R. Shirley Classic is Wake Forest's tournament. `null` otherwise.
 */
export const getTournamentBadge = (tournament: string | undefined | null): string | null => {
  if (!tournament) return null;
  return TOURNAMENT_BADGES.find(({ pattern }) => pattern.test(tournament))?.label ?? null;
};

/**
 * A tournament's logo: the tournament's own (TOC, NDT, CEDA, NSDA, Barkley
 * Forum, Shirley…), else its host school's from the shared school lookup, so
 * every school with a logo — and every other spelling of it — resolves here
 * too. `null` when neither has one.
 */
export const getTournamentLogo = (
  tournament: string | undefined | null,
): string | FC<SVGProps<SVGSVGElement>> | StaticImageData | null => {
  if (!tournament) return null;
  const base = tournament
    .replace(/\s*\(\d+\)/, "")
    .replace(/\d+/g, "")
    .replace(/\bround\s+robin\b/gi, "")
    .replace(/\bRR\b/g, "")
    .replace(/\b(TOC|finals|final|championships|invite|invitational|open|classic|tournament)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const key = slugify(base);
  if (TOURNAMENT_LOGO_MAP[key]) return TOURNAMENT_LOGO_MAP[key];
  // direct slug
  if (TOURNAMENT_LOGO_MAP[slugify(tournament)]) return TOURNAMENT_LOGO_MAP[slugify(tournament)];
  // also try matching by containing emory/barkley if it's barkley forum related
  const lower = tournament.toLowerCase();
  if (lower.includes("barkley") || lower.includes("emory")) {
    return TOURNAMENT_LOGO_MAP["emory"] || TOURNAMENT_LOGO_MAP["barkley"] || null;
  }
  if (getTournamentBadge(tournament) === "Shirley") return TOURNAMENT_LOGO_MAP["shirley"];
  // The host school, by any of its spellings ("University of KY", "USC").
  const school = getSchoolLogo(base) ?? getSchoolLogo(tournament);
  if (school) return school;
  // word-boundary fallback so "Berkeley Round Robin" or "Cal Invitational" still resolve
  const words = new Set(lower.split(/[^a-z0-9]+/));
  for (const alias of ["ndca", "nsda", "berkeley", "cal", "ndt", "toc", "ceda"]) {
    if (words.has(alias) && TOURNAMENT_LOGO_MAP[alias]) return TOURNAMENT_LOGO_MAP[alias];
  }
  return null;
};

export const hasTournamentLogo = (tournament: string | undefined | null): boolean => {
  return getTournamentLogo(tournament) !== null;
};
