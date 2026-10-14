/**
 * @fileoverview School logo mappings from debate-icons
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

export const SCHOOL_LOGO_MAP: Record<string, string | FC<SVGProps<SVGSVGElement>>> = {
  harvard: IconSchoolHarvard,
  "harvard-westlake": IconSchoolHarvardWestlake,
  greenhill: IconSchoolGreenhill,
  emory: IconSchoolEmory,
  georgetown: IconSchoolGeorgetown,
  ceda: IconSchoolCeda,
  "glenbrook-north": IconSchoolGlenbrookNorth,
  "glenbrook-south": IconSchoolGlenbrookNorth,
  northwestern: IconSchoolNorthwestern,
  "wake-forest": IconSchoolWakeForest,
  kentucky: IconSchoolKentucky,
  "michigan-state": IconSchoolMichiganState,
  ndt: IconSchoolNdt,
  dartmouth: IconSchoolDartmouth,
  redlands: IconSchoolRedlands,
  "st-marks": IconSchoolStMarks,
  westminster: IconSchoolWestminster,
  blake: IconSchoolBlake,
  harker: IconSchoolHarker,
};

export const getSchoolLogo = (
  school: string | undefined | null,
): string | FC<SVGProps<SVGSVGElement>> | null => {
  if (!school) return null;
  const key = slugify(school);
  if (SCHOOL_LOGO_MAP[key]) return SCHOOL_LOGO_MAP[key];
  return null;
};

export const hasSchoolLogo = (school: string | undefined | null): boolean => {
  return getSchoolLogo(school) !== null;
};
