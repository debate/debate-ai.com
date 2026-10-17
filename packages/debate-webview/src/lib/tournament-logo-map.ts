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
import IconSchoolNorthwestern from "../../../debate-icons/schools/northwestern.png";
import IconSchoolWakeForest from "../../../debate-icons/schools/wake-forest.png";
import IconSchoolKentucky from "../../../debate-icons/schools/kentucky.png";
import IconSchoolMichiganState from "../../../debate-icons/schools/michigan-state.png";
import IconSchoolMichigan from "../../../debate-icons/schools/michigan.png";
import IconSchoolNdt from "../../../debate-icons/schools/ndt.png";
import IconSchoolDartmouth from "../../../debate-icons/schools/dartmouth.png";
import IconSchoolRedlands from "../../../debate-icons/schools/redlands.png";
import IconSchoolStMarksSchoolOfTexas from "../../../debate-icons/schools/st-marks-school-of-texas.png";
import IconSchoolWestminster from "../../../debate-icons/schools/westminster.png";
import IconSchoolBlake from "../../../debate-icons/schools/blake.png";
import IconSchoolHarker from "../../../debate-icons/schools/harker.png";
import IconSchoolCollegePrep from "../../../debate-icons/schools/college-prep.png";
import IconSchoolCsuLongBeach from "../../../debate-icons/schools/csu-long-beach.png";
import IconSchoolIowa from "../../../debate-icons/schools/iowa.png";
import IconSchoolKansas from "../../../debate-icons/schools/kansas.png";
import IconSchoolMarlborough from "../../../debate-icons/schools/marlborough.png";
import IconSchoolNewTrier from "../../../debate-icons/schools/new-trier.png";
import IconSchoolStrakeJesuit from "../../../debate-icons/schools/strake-jesuit.png";
import IconSchoolTexas from "../../../debate-icons/schools/texas.png";
import IconSchoolUcBerkeley from "../../../debate-icons/schools/uc-berkeley.png";
import IconSchoolWesternKentucky from "../../../debate-icons/schools/western-kentucky.png";

const slugify = (s: string): string =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const logoSrc = (img: unknown): string =>
  typeof img === "object" && img !== null && "src" in img ? String((img as { src: unknown }).src) : (img as string);

export const TOURNAMENT_LOGO_MAP: Record<string, string | FC<SVGProps<SVGSVGElement>>> = {
  harvard: logoSrc(IconSchoolHarvard),
  "harvard-national": logoSrc(IconSchoolHarvard),
  "harvard-westlake": logoSrc(IconSchoolHarvardWestlake),
  greenhill: logoSrc(IconSchoolGreenhill),
  emory: logoSrc(IconSchoolEmory),
  barkley: logoSrc(IconSchoolEmory),
  "barkley-forum": logoSrc(IconSchoolEmory),
  "barkley-forum-emory": logoSrc(IconSchoolEmory),
  georgetown: logoSrc(IconSchoolGeorgetown),
  ceda: logoSrc(IconSchoolCeda),
  glenbrooks: logoSrc(IconSchoolGlenbrookNorth),
  "glenbrook-north": logoSrc(IconSchoolGlenbrookNorth),
  "glenbrook-south": logoSrc(IconSchoolGlenbrookSouth),
  northwestern: logoSrc(IconSchoolNorthwestern),
  "wake-forest": logoSrc(IconSchoolWakeForest),
  kentucky: logoSrc(IconSchoolKentucky),
  "michigan-state": logoSrc(IconSchoolMichiganState),
  michigan: logoSrc(IconSchoolMichigan),
  ndt: logoSrc(IconSchoolNdt),
  "national-debate-tournament": logoSrc(IconSchoolNdt),
  dartmouth: logoSrc(IconSchoolDartmouth),
  redlands: logoSrc(IconSchoolRedlands),
  "st-marks": logoSrc(IconSchoolStMarksSchoolOfTexas),
  "st-marks-school-of-texas": logoSrc(IconSchoolStMarksSchoolOfTexas),
  westminster: logoSrc(IconSchoolWestminster),
  blake: logoSrc(IconSchoolBlake),
  harker: logoSrc(IconSchoolHarker),
  "college-prep": logoSrc(IconSchoolCollegePrep),
  "college-preparatory-school": logoSrc(IconSchoolCollegePrep),
  "csu-long-beach": logoSrc(IconSchoolCsuLongBeach),
  "cal-state-long-beach": logoSrc(IconSchoolCsuLongBeach),
  iowa: logoSrc(IconSchoolIowa),
  "university-of-iowa": logoSrc(IconSchoolIowa),
  kansas: logoSrc(IconSchoolKansas),
  "university-of-kansas": logoSrc(IconSchoolKansas),
  marlborough: logoSrc(IconSchoolMarlborough),
  "new-trier": logoSrc(IconSchoolNewTrier),
  "new-trier-high-school": logoSrc(IconSchoolNewTrier),
  "strake-jesuit": logoSrc(IconSchoolStrakeJesuit),
  strake: logoSrc(IconSchoolStrakeJesuit),
  texas: logoSrc(IconSchoolTexas),
  "university-of-texas": logoSrc(IconSchoolTexas),
  "uc-berkeley": logoSrc(IconSchoolUcBerkeley),
  berkeley: logoSrc(IconSchoolUcBerkeley),
  "university-of-california-berkeley": logoSrc(IconSchoolUcBerkeley),
  "western-kentucky": logoSrc(IconSchoolWesternKentucky),
  "western-kentucky-university": logoSrc(IconSchoolWesternKentucky),
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
  const lower = tournament.toLowerCase();
  if (lower.includes("barkley") || lower.includes("emory")) {
    return TOURNAMENT_LOGO_MAP["emory"] || TOURNAMENT_LOGO_MAP["barkley"] || null;
  }
  if (lower.includes("st marks") || lower.includes("st. marks") || lower.includes("st-marks")) {
    return TOURNAMENT_LOGO_MAP["st-marks"] || TOURNAMENT_LOGO_MAP["st-marks-school-of-texas"] || null;
  }
  if (lower.includes("glenbrook south")) return TOURNAMENT_LOGO_MAP["glenbrook-south"] || null;
  if (lower.includes("glenbrook north")) return TOURNAMENT_LOGO_MAP["glenbrook-north"] || null;
  if (lower.includes("glenbrook")) return TOURNAMENT_LOGO_MAP["glenbrook-north"] || null;
  if (lower.includes("harvard westlake")) return TOURNAMENT_LOGO_MAP["harvard-westlake"] || null;
  if (lower.includes("college prep")) return TOURNAMENT_LOGO_MAP["college-prep"] || null;
  if (lower.includes("csu long beach") || lower.includes("cal state long beach")) return TOURNAMENT_LOGO_MAP["csu-long-beach"] || null;
  if (lower.includes("new trier")) return TOURNAMENT_LOGO_MAP["new-trier"] || null;
  if (lower.includes("strake")) return TOURNAMENT_LOGO_MAP["strake-jesuit"] || null;
  if (lower.includes("western kentucky")) return TOURNAMENT_LOGO_MAP["western-kentucky"] || null;
  if (lower.includes("montgomery bell")) return null;
  if (lower.includes("uc berkeley") || lower.includes("berkeley")) return TOURNAMENT_LOGO_MAP["uc-berkeley"] || null;
  return null;
};
