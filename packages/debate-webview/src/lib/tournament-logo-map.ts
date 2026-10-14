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
import IconSchoolNorthwestern from "../../../debate-icons/schools/northwestern.svg";
import IconSchoolWakeForest from "../../../debate-icons/schools/wake-forest.svg";
import IconSchoolKentucky from "../../../debate-icons/schools/kentucky.svg";
import IconSchoolMichiganState from "../../../debate-icons/schools/michigan-state.png";
import IconSchoolNdt from "../../../debate-icons/schools/ndt.png";
import IconSchoolDartmouth from "../../../debate-icons/schools/dartmouth.svg";
import IconSchoolRedlands from "../../../debate-icons/schools/redlands.svg";
import IconSchoolStMarks from "../../../debate-icons/schools/st-marks.png";
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

/**
 * An image import's URL. Next types `.png`/`.svg` imports as
 * `StaticImageData` (`{ src, width, height }`) while other bundlers hand
 * back the URL string, so the map stores the string either way and callers
 * never mistake the object for a component.
 */
const logoSrc = (img: unknown): string =>
  typeof img === "object" && img !== null && "src" in img ? String((img as { src: unknown }).src) : (img as string);

export const TOURNAMENT_LOGO_MAP: Record<string, string | FC<SVGProps<SVGSVGElement>>> = {
  harvard: logoSrc(IconSchoolHarvard),
  "harvard-national": logoSrc(IconSchoolHarvard),
  "harvard-westlake": logoSrc(IconSchoolHarvardWestlake),
  greenhill: logoSrc(IconSchoolGreenhill),
  emory: logoSrc(IconSchoolEmory),
  georgetown: logoSrc(IconSchoolGeorgetown),
  ceda: logoSrc(IconSchoolCeda),
  glenbrooks: logoSrc(IconSchoolGlenbrookNorth),
  "glenbrook-north": logoSrc(IconSchoolGlenbrookNorth),
  "glenbrook-south": logoSrc(IconSchoolGlenbrookNorth),
  northwestern: logoSrc(IconSchoolNorthwestern),
  "wake-forest": logoSrc(IconSchoolWakeForest),
  kentucky: logoSrc(IconSchoolKentucky),
  "michigan-state": logoSrc(IconSchoolMichiganState),
  ndt: logoSrc(IconSchoolNdt),
  "national-debate-tournament": logoSrc(IconSchoolNdt),
  dartmouth: logoSrc(IconSchoolDartmouth),
  redlands: logoSrc(IconSchoolRedlands),
  "st-marks": logoSrc(IconSchoolStMarks),
  westminster: logoSrc(IconSchoolWestminster),
  blake: logoSrc(IconSchoolBlake),
  harker: logoSrc(IconSchoolHarker),
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
