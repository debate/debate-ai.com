/**
 * @fileoverview Tournament logo mappings
 */

import type { FC, SVGProps } from "react";

import IconSchoolHarvard from "../../../debate-icons/schools/harvard.png";
import IconSchoolHarvardWestlake from "../../../debate-icons/schools/harvard-westlake.png";
import IconSchoolGreenhill from "../../../debate-icons/schools/greenhill.png";
import IconSchoolEmory from "../../../debate-icons/schools/emory.png";
import IconSchoolGeorgetown from "../../../debate-icons/schools/georgetown.png";
import IconSchoolCeda from "../../../debate-icons/schools/ceda.png";
import IconSchoolGlenbrookNorth from "../../../debate-icons/schools/glenbrook-north.png";
import IconSchoolGlenbrookSouth from "../../../debate-icons/schools/glenbrook-south.png";
import IconSchoolNorthwestern from "../../../debate-icons/schools/northwestern.svg";
import IconSchoolWakeForest from "../../../debate-icons/schools/wake-forest.svg";
import IconSchoolKentucky from "../../../debate-icons/schools/kentucky.png";
import IconSchoolMichiganState from "../../../debate-icons/schools/michigan-state.png";
import IconSchoolNdt from "../../../debate-icons/schools/ndt.png";
import IconSchoolDartmouth from "../../../debate-icons/schools/dartmouth.png";
import IconSchoolRedlands from "../../../debate-icons/schools/redlands.svg";
import IconSchoolStMarks from "../../../debate-icons/schools/st-marks-school-of-texas.png";
import IconSchoolWestminster from "../../../debate-icons/schools/westminster.png";
import IconSchoolBlake from "../../../debate-icons/schools/blake.png";
import IconSchoolHarker from "../../../debate-icons/schools/harker.png";

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
  "glenbrook-south": IconSchoolGlenbrookSouth,
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
