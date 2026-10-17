/**
 * @fileoverview Tournament logo mappings using school/tournament logos from debate-icons
 */

import type { FC, SVGProps } from "react";
import type { StaticImageData } from "next/image";

// Import school logos that might also be used for tournaments
import IconSchoolHarvard from "../../../../debate-icons/schools/harvard.png";
import IconSchoolHarvardWestlake from "../../../../debate-icons/schools/harvard-westlake.png";
import IconSchoolGreenhill from "../../../../debate-icons/schools/greenhill.png";
import IconSchoolEmory from "../../../../debate-icons/schools/emory.png";
import IconSchoolGeorgetown from "../../../../debate-icons/schools/georgetown.png";
import IconSchoolCeda from "../../../../debate-icons/schools/ceda.png";
import IconSchoolGlenbrookNorth from "../../../../debate-icons/schools/glenbrook-north.png";
import IconSchoolNorthwestern from "../../../../debate-icons/schools/northwestern.png";
import IconSchoolWakeForest from "../../../../debate-icons/schools/wake-forest.png";
import IconSchoolKentucky from "../../../../debate-icons/schools/kentucky.png";
import IconSchoolMichiganState from "../../../../debate-icons/schools/michigan-state.png";
import IconSchoolNdt from "../../../../debate-icons/schools/ndt.png";
import IconSchoolDartmouth from "../../../../debate-icons/schools/dartmouth.png";
import IconSchoolRedlands from "../../../../debate-icons/schools/redlands.png";
import IconSchoolStMarks from "../../../../debate-icons/schools/st-marks-school-of-texas.png";
import IconSchoolWestminster from "../../../../debate-icons/schools/westminster.png";
import IconSchoolBlake from "../../../../debate-icons/schools/blake.png";
import IconSchoolHarker from "../../../../debate-icons/schools/harker.png";

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
  "glenbrook-south": (IconSchoolGlenbrookNorth as any)?.src ?? (IconSchoolGlenbrookNorth as any),
  northwestern: (IconSchoolNorthwestern as any)?.src ?? (IconSchoolNorthwestern as any),
  "wake-forest": (IconSchoolWakeForest as any)?.src ?? (IconSchoolWakeForest as any),
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
};

export const getTournamentLogo = (
  tournament: string | undefined | null,
): string | FC<SVGProps<SVGSVGElement>> | StaticImageData | null => {
  if (!tournament) return null;
  const base = tournament
    .replace(/\s*\(\d+\)/, "")
    .replace(/\d+/g, "")
    .replace(/\b(TOC|finals|final|championships|invite|invitational|open|classic|tournament)\b/gi, "")
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
  return null;
};

export const hasTournamentLogo = (tournament: string | undefined | null): boolean => {
  return getTournamentLogo(tournament) !== null;
};
