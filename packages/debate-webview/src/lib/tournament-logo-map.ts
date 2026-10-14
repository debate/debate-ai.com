/**
 * @fileoverview Tournament logo mappings
 */

import type { FC, SVGProps } from "react";

import {
  IconSchoolHarvard,
  IconSchoolHarvardWestlake,
  IconSchoolGreenhill,
  IconSchoolEmory,
  IconSchoolGeorgetown,
  IconSchoolCeda,
  IconSchoolGlenbrookNorth,
  IconSchoolNorthwestern,
  IconSchoolWakeForest,
  IconSchoolKentucky,
  IconSchoolMichiganState,
  IconSchoolNdt,
  IconSchoolDartmouth,
  IconSchoolRedlands,
  IconSchoolStMarks,
  IconSchoolWestminster,
  IconSchoolBlake,
  IconSchoolHarker,
} from "@debate/icons/schools";

const slugify = (s: string): string =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const TOURNAMENT_LOGO_MAP: Record<string, string | FC<SVGProps<SVGSVGElement>>> = {
  harvard: IconSchoolHarvard,
  "harvard-national": IconSchoolHarvard,
  "harvard-westlake": IconSchoolHarvardWestlake,
  greenhill: IconSchoolGreenhill,
  emory: IconSchoolEmory,
  georgetown: IconSchoolGeorgetown,
  ceda: IconSchoolCeda,
  glenbrooks: IconSchoolGlenbrookNorth,
  "glenbrook-north": IconSchoolGlenbrookNorth,
  "glenbrook-south": IconSchoolGlenbrookNorth,
  northwestern: IconSchoolNorthwestern,
  "wake-forest": IconSchoolWakeForest,
  kentucky: IconSchoolKentucky,
  "michigan-state": IconSchoolMichiganState,
  ndt: IconSchoolNdt,
  "national-debate-tournament": IconSchoolNdt,
  dartmouth: IconSchoolDartmouth,
  redlands: IconSchoolRedlands,
  "st-marks": IconSchoolStMarks,
  westminster: IconSchoolWestminster,
  blake: IconSchoolBlake,
  harker: IconSchoolHarker,
};

export const getTournamentLogo = (
  tournament: string | undefined | null,
): string | FC<SVGProps<SVGSVGElement>> | null => {
  if (!tournament) return null;
  const base = tournament
    .replace(/\s*\(\d+\)/, "")
    .replace(/\d+/g, "")
    .replace(/\b(TOC|finals|final|championships|invite|invitational|open|classic|tournament)\b/gi, "")
    .trim();
  const key = slugify(base);
  if (TOURNAMENT_LOGO_MAP[key]) return TOURNAMENT_LOGO_MAP[key];
  if (TOURNAMENT_LOGO_MAP[slugify(tournament)]) return TOURNAMENT_LOGO_MAP[slugify(tournament)];
  return null;
};
