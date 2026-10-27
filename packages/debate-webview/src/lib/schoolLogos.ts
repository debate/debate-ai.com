/**
 * @fileoverview School logo mappings from debate-icons
 */

import type { FC, SVGProps } from "react";
import type { StaticImageData } from "next/image";

import IconSchoolBlake from "../../../debate-icons/schools/blake.png";
import IconSchoolCeda from "../../../debate-icons/schools/ceda.png";
import IconSchoolCollegePrep from "../../../debate-icons/schools/college-prep.png";
import IconSchoolCsuLongBeach from "../../../debate-icons/schools/csu-long-beach.png";
import IconSchoolDartmouth from "../../../debate-icons/schools/dartmouth.png";
import IconSchoolEmory from "../../../debate-icons/schools/emory.png";
import IconSchoolGeorgetown from "../../../debate-icons/schools/georgetown.png";
import IconSchoolGlenbrookNorth from "../../../debate-icons/schools/glenbrook-north.png";
import IconSchoolGlenbrookSouth from "../../../debate-icons/schools/glenbrook-south.png";
import IconSchoolGreenhill from "../../../debate-icons/schools/greenhill.png";
import IconSchoolHarker from "../../../debate-icons/schools/harker.png";
import IconSchoolHarvard from "../../../debate-icons/schools/harvard.png";
import IconSchoolHarvardWestlake from "../../../debate-icons/schools/harvard-westlake.png";
import IconSchoolIowa from "../../../debate-icons/schools/iowa.png";
import IconSchoolKansas from "../../../debate-icons/schools/kansas.png";
import IconSchoolKentucky from "../../../debate-icons/schools/kentucky.png";
import IconSchoolMarlborough from "../../../debate-icons/schools/marlborough.png";
import IconSchoolMichigan from "../../../debate-icons/schools/michigan.png";
import IconSchoolMichiganState from "../../../debate-icons/schools/michigan-state.png";
import IconSchoolNdt from "../../../debate-icons/schools/ndt.png";
import IconSchoolNewTrier from "../../../debate-icons/schools/new-trier.png";
import IconSchoolNorthwestern from "../../../debate-icons/schools/northwestern.png";
import IconSchoolRedlands from "../../../debate-icons/schools/redlands.png";
import IconSchoolStMarks from "../../../debate-icons/schools/st-marks-school-of-texas.png";
import IconSchoolStrakeJesuit from "../../../debate-icons/schools/strake-jesuit.png";
import IconSchoolTexas from "../../../debate-icons/schools/texas.png";
import IconSchoolUcBerkeley from "../../../debate-icons/schools/uc-berkeley.png";
import IconSchoolWakeForest from "../../../debate-icons/schools/wake-forest.png";
import IconSchoolWesternKentucky from "../../../debate-icons/schools/western-kentucky.png";
import IconSchoolWestminster from "../../../debate-icons/schools/westminster.png";

const slugify = (s: string): string =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036F]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const SCHOOL_LOGO_MAP: Record<string, string | FC<SVGProps<SVGSVGElement>> | StaticImageData> = {
  blake: (IconSchoolBlake as any)?.src ?? (IconSchoolBlake as any),
  "college-prep": (IconSchoolCollegePrep as any)?.src ?? (IconSchoolCollegePrep as any),
  ceda: (IconSchoolCeda as any)?.src ?? (IconSchoolCeda as any),
  "csu-long-beach": (IconSchoolCsuLongBeach as any)?.src ?? (IconSchoolCsuLongBeach as any),
  dartmouth: (IconSchoolDartmouth as any)?.src ?? (IconSchoolDartmouth as any),
  emory: (IconSchoolEmory as any)?.src ?? (IconSchoolEmory as any),
  georgetown: (IconSchoolGeorgetown as any)?.src ?? (IconSchoolGeorgetown as any),
  "glenbrook-north": (IconSchoolGlenbrookNorth as any)?.src ?? (IconSchoolGlenbrookNorth as any),
  "glenbrook-south": (IconSchoolGlenbrookSouth as any)?.src ?? (IconSchoolGlenbrookSouth as any),
  greenhill: (IconSchoolGreenhill as any)?.src ?? (IconSchoolGreenhill as any),
  harker: (IconSchoolHarker as any)?.src ?? (IconSchoolHarker as any),
  harvard: (IconSchoolHarvard as any)?.src ?? (IconSchoolHarvard as any),
  "harvard-westlake": (IconSchoolHarvardWestlake as any)?.src ?? (IconSchoolHarvardWestlake as any),
  iowa: (IconSchoolIowa as any)?.src ?? (IconSchoolIowa as any),
  kansas: (IconSchoolKansas as any)?.src ?? (IconSchoolKansas as any),
  kentucky: (IconSchoolKentucky as any)?.src ?? (IconSchoolKentucky as any),
  marlborough: (IconSchoolMarlborough as any)?.src ?? (IconSchoolMarlborough as any),
  michigan: (IconSchoolMichigan as any)?.src ?? (IconSchoolMichigan as any),
  "michigan-state": (IconSchoolMichiganState as any)?.src ?? (IconSchoolMichiganState as any),
  ndt: (IconSchoolNdt as any)?.src ?? (IconSchoolNdt as any),
  "new-trier": (IconSchoolNewTrier as any)?.src ?? (IconSchoolNewTrier as any),
  northwestern: (IconSchoolNorthwestern as any)?.src ?? (IconSchoolNorthwestern as any),
  redlands: (IconSchoolRedlands as any)?.src ?? (IconSchoolRedlands as any),
  "st-marks": (IconSchoolStMarks as any)?.src ?? (IconSchoolStMarks as any),
  "st-marks-tx": (IconSchoolStMarks as any)?.src ?? (IconSchoolStMarks as any),
  "st-marks-school-of-texas": (IconSchoolStMarks as any)?.src ?? (IconSchoolStMarks as any),
  "strake-jesuit": (IconSchoolStrakeJesuit as any)?.src ?? (IconSchoolStrakeJesuit as any),
  texas: (IconSchoolTexas as any)?.src ?? (IconSchoolTexas as any),
  "uc-berkeley": (IconSchoolUcBerkeley as any)?.src ?? (IconSchoolUcBerkeley as any),
  "wake-forest": (IconSchoolWakeForest as any)?.src ?? (IconSchoolWakeForest as any),
  "western-kentucky": (IconSchoolWesternKentucky as any)?.src ?? (IconSchoolWesternKentucky as any),
  westminster: (IconSchoolWestminster as any)?.src ?? (IconSchoolWestminster as any),
};

/**
 * Other spellings of a school, slugged, mapped to its key in
 * {@link SCHOOL_LOGO_MAP}: nicknames ("Cal", "Wake"), abbreviations
 * ("CSULB", "WKU") and typos seen in video titles ("Kentcuky"). Full names
 * like "University of Kansas" or "California State University - Long Beach"
 * mostly resolve by {@link schoolLogoKeys} trimming "University" and
 * "College"; this list covers the rest.
 */
const SCHOOL_LOGO_ALIASES: Record<string, string> = {
  berkeley: "uc-berkeley",
  cal: "uc-berkeley",
  "cal-berkeley": "uc-berkeley",
  "california-berkeley": "uc-berkeley",
  ucb: "uc-berkeley",
  "cal-state-long-beach": "csu-long-beach",
  "california-state-long-beach": "csu-long-beach",
  "csu-lb": "csu-long-beach",
  csulb: "csu-long-beach",
  "long-beach": "csu-long-beach",
  "long-beach-state": "csu-long-beach",
  kentcuky: "kentucky",
  msu: "michigan-state",
  "texas-austin": "texas",
  "ut-austin": "texas",
  wake: "wake-forest",
  wku: "western-kentucky",
};

/**
 * The keys a school name could be filed under, most literal first: its slug,
 * then with a leading "the", "university of" and a trailing "university" or
 * "college" trimmed. "University of Texas - Dallas" becomes "texas-dallas",
 * never "texas" â a campus stays its own school.
 */
function schoolLogoKeys(school: string): string[] {
  const slug = slugify(school);
  const trimmed = slug
    .replace(/^the-/, "")
    .replace(/^university-of-/, "")
    .replace(/-(university|college)$/, "")
    .replace(/-state-university-/, "-state-");
  return trimmed === slug ? [slug] : [slug, trimmed];
}

/**
 * A school's logo from `debate-icons`, or `null`. Accepts the short names
 * debaters use ("Kansas", "Cal"), full official names ("University of
 * Kansas", "University of California - Berkeley") and the aliases above.
 */
export const getSchoolLogo = (
  school: string | undefined | null,
): string | FC<SVGProps<SVGSVGElement>> | StaticImageData | null => {
  if (!school) return null;
  for (const key of schoolLogoKeys(school)) {
    const found = SCHOOL_LOGO_MAP[key] ?? SCHOOL_LOGO_MAP[SCHOOL_LOGO_ALIASES[key] ?? ""];
    if (found) return found;
  }
  const lower = school.toLowerCase();
  if (lower.includes("st marks") || lower.includes("st. marks") || lower.includes("st-marks")) {
    return SCHOOL_LOGO_MAP["st-marks"];
  }
  return null;
};

export const hasSchoolLogo = (school: string | undefined | null): boolean => {
  return getSchoolLogo(school) !== null;
};
