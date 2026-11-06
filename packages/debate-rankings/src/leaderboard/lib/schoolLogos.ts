/**
 * @fileoverview School logo mappings from debate-icons — the one lookup every
 * school name in the app goes through: team pills, rankings, school pages,
 * and (as a fallback) tournament logos in the video library and judge pool.
 * A test pins that every png in `debate-icons/colleges` and
 * `debate-icons/high-schools` is mapped here.
 */

import type { FC, SVGProps } from "react";
import type { StaticImageData } from "next/image";

import {
  IconSchoolBlake,
  IconSchoolBronx,
  IconSchoolCeda,
  IconSchoolCollegePrep,
  IconSchoolBaylor,
  IconSchoolCsuLongBeach,
  IconSchoolDartmouth,
  IconSchoolEmory,
  IconSchoolGeorgeMason,
  IconSchoolGeorgia,
  IconSchoolGeorgetown,
  IconSchoolGlenbrookNorth,
  IconSchoolGlenbrookSouth,
  IconSchoolGreenhill,
  IconSchoolHarker,
  IconSchoolHarvard,
  IconSchoolHarvardWestlake,
  IconSchoolHouston,
  IconSchoolIowa,
  IconSchoolKansas,
  IconSchoolKentucky,
  IconSchoolLiberty,
  IconSchoolLoyolaChicago,
  IconSchoolLynbrook,
  IconSchoolMacalester,
  IconSchoolMarlborough,
  IconSchoolMichigan,
  IconSchoolMichiganState,
  IconSchoolMontgomeryBell,
  IconSchoolNdt,
  IconSchoolNewTrier,
  IconSchoolNorthTexas,
  IconSchoolNorthwestern,
  IconSchoolPlanoWest,
  IconSchoolRedlands,
  IconSchoolSouthernCalifornia,
  IconSchoolStMarksSchoolOfTexas,
  IconSchoolStrakeJesuit,
  IconSchoolTexas,
  IconSchoolTowson,
  IconSchoolUtDallas,
  IconSchoolYale,
  IconSchoolUcBerkeley,
  IconSchoolWakeForest,
  IconSchoolWalterPayton,
  IconSchoolWesternKentucky,
  IconSchoolWestminster,
  IconSchoolWestwood,
  IconSchoolWhitneyYoung,
  IconSchoolWoodward,
} from "@debate-ai/icons/schools";

const slugify = (s: string): string =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036F]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

type SchoolLogo = string | FC<SVGProps<SVGSVGElement>> | StaticImageData;

/** A bundled png's URL: Next hands back `{ src }`, Vite a plain string. */
const logoSrc = (img: unknown): SchoolLogo =>
  ((img as { src?: string } | null)?.src ?? img) as SchoolLogo;

/**
 * Every png in `debate-icons/colleges` and `high-schools`, keyed by its
 * file name, plus the CEDA and NDT logos from `organizations`.
 */
export const SCHOOL_LOGO_MAP: Record<string, SchoolLogo> = {
  "blake": logoSrc(IconSchoolBlake),
  "bronx": logoSrc(IconSchoolBronx),
  "ceda": logoSrc(IconSchoolCeda),
  "college-prep": logoSrc(IconSchoolCollegePrep),
  "baylor": logoSrc(IconSchoolBaylor),
  "csu-long-beach": logoSrc(IconSchoolCsuLongBeach),
  "dartmouth": logoSrc(IconSchoolDartmouth),
  "emory": logoSrc(IconSchoolEmory),
  "george-mason": logoSrc(IconSchoolGeorgeMason),
  "georgetown": logoSrc(IconSchoolGeorgetown),
  "georgia": logoSrc(IconSchoolGeorgia),
  "glenbrook-north": logoSrc(IconSchoolGlenbrookNorth),
  "glenbrook-south": logoSrc(IconSchoolGlenbrookSouth),
  "greenhill": logoSrc(IconSchoolGreenhill),
  "harker": logoSrc(IconSchoolHarker),
  "harvard": logoSrc(IconSchoolHarvard),
  "harvard-westlake": logoSrc(IconSchoolHarvardWestlake),
  "houston": logoSrc(IconSchoolHouston),
  "iowa": logoSrc(IconSchoolIowa),
  "kansas": logoSrc(IconSchoolKansas),
  "kentucky": logoSrc(IconSchoolKentucky),
  "liberty": logoSrc(IconSchoolLiberty),
  // Not plain "loyola": in the rankings that is Loyola High School (CA).
  "loyola-chicago": logoSrc(IconSchoolLoyolaChicago),
  "lynbrook": logoSrc(IconSchoolLynbrook),
  "macalester": logoSrc(IconSchoolMacalester),
  "marlborough": logoSrc(IconSchoolMarlborough),
  "michigan": logoSrc(IconSchoolMichigan),
  "michigan-state": logoSrc(IconSchoolMichiganState),
  "montgomery-bell": logoSrc(IconSchoolMontgomeryBell),
  "ndt": logoSrc(IconSchoolNdt),
  "new-trier": logoSrc(IconSchoolNewTrier),
  "north-texas": logoSrc(IconSchoolNorthTexas),
  "northwestern": logoSrc(IconSchoolNorthwestern),
  "plano-west": logoSrc(IconSchoolPlanoWest),
  "redlands": logoSrc(IconSchoolRedlands),
  "southern-california": logoSrc(IconSchoolSouthernCalifornia),
  "st-marks": logoSrc(IconSchoolStMarksSchoolOfTexas),
  "strake-jesuit": logoSrc(IconSchoolStrakeJesuit),
  "texas": logoSrc(IconSchoolTexas),
  "towson": logoSrc(IconSchoolTowson),
  "ut-dallas": logoSrc(IconSchoolUtDallas),
  "uc-berkeley": logoSrc(IconSchoolUcBerkeley),
  "wake-forest": logoSrc(IconSchoolWakeForest),
  "walter-payton": logoSrc(IconSchoolWalterPayton),
  "western-kentucky": logoSrc(IconSchoolWesternKentucky),
  "westminster": logoSrc(IconSchoolWestminster),
  "westwood": logoSrc(IconSchoolWestwood),
  "whitney-young": logoSrc(IconSchoolWhitneyYoung),
  "woodward": logoSrc(IconSchoolWoodward),
  "yale": logoSrc(IconSchoolYale),
};

/**
 * Other spellings of a school, slugged, mapped to its key in
 * {@link SCHOOL_LOGO_MAP}: nicknames ("Cal", "Wake"), abbreviations
 * ("CSULB", "WKU", "GBN"), long official names and typos seen in video titles
 * ("Kentcuky"). Full names like "University of Kansas" or "Glenbrook North
 * High School" mostly resolve by {@link schoolLogoKeys} trimming "University
 * of", "High School" and the like; this list covers the rest.
 */
const SCHOOL_LOGO_ALIASES: Record<string, string> = {
  // Blake
  "blake-school": "blake",
  // Bronx Science
  "bronx-science": "bronx",
  "bronx-sci": "bronx",
  bxsci: "bronx",
  "bronx-high-school-of-science": "bronx",
  "bronx-hs-of-science": "bronx",
  "bronx-h-s-of-science": "bronx",
  "bronx-school-of-science": "bronx",
  // College Prep
  "college-preparatory": "college-prep",
  "college-preparatory-school": "college-prep",
  // CSU Long Beach
  "cal-state-long-beach": "csu-long-beach",
  "california-state-long-beach": "csu-long-beach",
  "csu-lb": "csu-long-beach",
  csulb: "csu-long-beach",
  "long-beach": "csu-long-beach",
  "long-beach-state": "csu-long-beach",
  // Glenbrooks
  gbn: "glenbrook-north",
  "glenbrook-n": "glenbrook-north",
  gbs: "glenbrook-south",
  "glenbrook-s": "glenbrook-south",
  // George Mason
  gmu: "george-mason",
  // Georgia
  "university-of-georgia": "georgia",
  uga: "georgia",
  // Georgetown
  gtown: "georgetown",
  // Harvard-Westlake
  hw: "harvard-westlake",
  "harvard-west-lake": "harvard-westlake",
  "harvard-westlake-school": "harvard-westlake",
  // Kansas
  ku: "kansas",
  // Kentucky
  kentcuky: "kentucky",
  ky: "kentucky",
  uk: "kentucky",
  "kentucky-wildcats": "kentucky",
  // Liberty
  "liberty-flames": "liberty",
  // Loyola Chicago
  "loyola-university-chicago": "loyola-chicago",
  "loyola-university-chicago-il": "loyola-chicago",
  // Lynbrook
  "lynbrook-sj": "lynbrook",
  "lynbrook-san-jose": "lynbrook",
  // Michigan
  umich: "michigan",
  "michigan-ann-arbor": "michigan",
  // Michigan State
  msu: "michigan-state",
  // Montgomery Bell
  mba: "montgomery-bell",
  "montgomery-bell-academy": "montgomery-bell",
  // New Trier
  "new-trier-township": "new-trier",
  // North Texas
  unt: "north-texas",
  // Plano West
  "plano-west-senior": "plano-west",
  "plano-west-senior-high": "plano-west",
  pwsh: "plano-west",
  // Southern California
  usc: "southern-california",
  "southern-cal": "southern-california",
  "u-southern-california": "southern-california",
  "univ-of-southern-california": "southern-california",
  // St. Mark's
  "st-marks-tx": "st-marks",
  "st-marks-texas": "st-marks",
  "saint-marks": "st-marks",
  "saint-marks-school-of-texas": "st-marks",
  "st-marks-school-of-texas": "st-marks",
  smtx: "st-marks",
  // Strake Jesuit
  strake: "strake-jesuit",
  // Texas
  "texas-austin": "texas",
  "ut-austin": "texas",
  // UT Dallas
  "texas-dallas": "ut-dallas",
  utd: "ut-dallas",
  // UC Berkeley
  berkeley: "uc-berkeley",
  cal: "uc-berkeley",
  "cal-berkeley": "uc-berkeley",
  "california-berkeley": "uc-berkeley",
  ucb: "uc-berkeley",
  // Wake Forest
  wake: "wake-forest",
  wfu: "wake-forest",
  // Walter Payton
  payton: "walter-payton",
  wpcp: "walter-payton",
  "payton-college-prep": "walter-payton",
  "walter-payton-college-prep": "walter-payton",
  "walter-payton-college-preparatory": "walter-payton",
  // Western Kentucky
  wku: "western-kentucky",
  // Westminster
  "westminster-schools": "westminster",
  // Whitney Young
  "whitney-young-magnet": "whitney-young",
  "whitney-m-young": "whitney-young",
  "whitney-m-young-magnet": "whitney-young",
};

/** Trailing words a school name can carry that never change the school. */
const SCHOOL_SUFFIXES =
  /-(?:senior-high-school|high-school|senior-high|h-s|hs|secondary-school|preparatory-school|prep-school|college-preparatory|college-prep|school|schools|academy|university|college|univ)$/;

/**
 * The keys a school name could be filed under, most literal first: its slug,
 * then with a leading "the", "university of" and trailing words like
 * "university", "college", "high school" or "HS" trimmed. "University of
 * Texas - Dallas" becomes "texas-dallas", never "texas" — a campus stays its
 * own school.
 */
function schoolLogoKeys(school: string): string[] {
  const slug = slugify(school);
  const keys = [slug];
  let trimmed = slug
    .replace(/^the-/, "")
    .replace(/^(?:university|univ)-of-/, "")
    .replace(/-state-university-/, "-state-");
  // Strip suffixes one at a time ("Strake Jesuit College Preparatory School").
  for (let i = 0; i < 3; i++) {
    if (!keys.includes(trimmed)) keys.push(trimmed);
    const next = trimmed.replace(SCHOOL_SUFFIXES, "");
    if (next === trimmed || !next) break;
    trimmed = next;
  }
  if (!keys.includes(trimmed)) keys.push(trimmed);
  return keys;
}

/**
 * A school's logo from `debate-icons`, or `null`. Accepts the short names
 * debaters use ("Kansas", "Cal"), full official names ("University of
 * Kansas", "Bronx High School of Science", "Walter Payton College Prep") and
 * the aliases above.
 */
export const getSchoolLogo = (school: string | undefined | null): SchoolLogo | null => {
  if (!school) return null;
  for (const key of schoolLogoKeys(school)) {
    const found = SCHOOL_LOGO_MAP[key] ?? SCHOOL_LOGO_MAP[SCHOOL_LOGO_ALIASES[key] ?? ""];
    if (found) return found;
  }
  return null;
};

export const hasSchoolLogo = (school: string | undefined | null): boolean => {
  return getSchoolLogo(school) !== null;
};
