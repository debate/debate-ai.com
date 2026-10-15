/**
 * @fileoverview School logo mappings
 */

import type { FC, SVGProps } from "react";

import IconSchoolHarvard from "../../../debate-icons/schools/harvard.png";
import IconSchoolHarvardWestlake from "../../../debate-icons/schools/harvard-westlake.png";
import IconSchoolGreenhill from "../../../debate-icons/schools/greenhill.png";
import IconSchoolEmory from "../../../debate-icons/schools/emory.png";
import IconSchoolGeorgetown from "../../../debate-icons/schools/georgetown.png";
import IconSchoolCeda from "../../../debate-icons/schools/ceda.png";
import IconSchoolGlenbrookNorth from "../../../debate-icons/schools/glenbrook-north.png";
import IconSchoolNorthwestern from "../../../debate-icons/schools/northwestern.png";
import IconSchoolWakeForest from "../../../debate-icons/schools/wake-forest.png";
import IconSchoolKentucky from "../../../debate-icons/schools/kentucky.svg";
import IconSchoolMichiganState from "../../../debate-icons/schools/michigan-state.png";
import IconSchoolNdt from "../../../debate-icons/schools/ndt.png";
import IconSchoolDartmouth from "../../../debate-icons/schools/dartmouth.svg";
import IconSchoolRedlands from "../../../debate-icons/schools/redlands.png";
import IconSchoolStMarks from "../../../debate-icons/schools/st-marks.png";
import IconSchoolWestminster from "../../../debate-icons/schools/westminster.png";
import IconSchoolBlake from "../../../debate-icons/schools/blake.png";
import IconSchoolHarker from "../../../debate-icons/schools/harker.png";
import IconSchoolKansas from "../../../debate-icons/schools/kansas.png";
import IconSchoolMichigan from "../../../debate-icons/schools/michigan.png";
import IconSchoolTexas from "../../../debate-icons/schools/texas.png";
import IconSchoolUcBerkeley from "../../../debate-icons/schools/uc-berkeley.png";

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
  kansas: IconSchoolKansas,
  michigan: IconSchoolMichigan,
  texas: IconSchoolTexas,
  "uc-berkeley": IconSchoolUcBerkeley,
};

export const getSchoolLogo = (
  school: string | undefined | null,
): string | FC<SVGProps<SVGSVGElement>> | null => {
  if (!school) return null;
  const key = slugify(school);
  if (SCHOOL_LOGO_MAP[key]) return SCHOOL_LOGO_MAP[key];
  return null;
};
