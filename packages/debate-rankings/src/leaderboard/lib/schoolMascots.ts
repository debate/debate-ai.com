/**
 * @fileoverview School mascot thumbnails from debate-icons, looked up by any
 * spelling of a school name the way logos are (`getSchoolLogo`): "Kansas",
 * "University of Kansas" and nicknames like "Cal" or "Wake" all resolve. Only
 * colleges have mascots so far. A test pins that every thumbnail in
 * `debate-icons/mascots/thumbs` is mapped here.
 */

import type { StaticImageData } from "next/image";
import {
  IconMascotDartmouth,
  IconMascotEmory,
  IconMascotGeorgetown,
  IconMascotIowa,
  IconMascotKansas,
  IconMascotMichigan,
  IconMascotMichiganState,
  IconMascotNorthwestern,
  IconMascotOklahoma,
  IconMascotTexas,
  IconMascotUcBerkeley,
  IconMascotWakeForest,
} from "@debate-ai/icons/mascots";
import { findSchoolAsset } from "./schoolLogos";

/** A bundled image's URL: Next hands back `{ src }`, Vite a plain string. */
const mascotSrc = (img: string | StaticImageData): string =>
  typeof img === "string" ? img : img.src;

/** Every mascot thumbnail, keyed by its file name (the school's logo key). */
export const SCHOOL_MASCOT_MAP: Record<string, string> = {
  "dartmouth": mascotSrc(IconMascotDartmouth),
  "emory": mascotSrc(IconMascotEmory),
  "georgetown": mascotSrc(IconMascotGeorgetown),
  "iowa": mascotSrc(IconMascotIowa),
  "kansas": mascotSrc(IconMascotKansas),
  "michigan": mascotSrc(IconMascotMichigan),
  "michigan-state": mascotSrc(IconMascotMichiganState),
  "northwestern": mascotSrc(IconMascotNorthwestern),
  "oklahoma": mascotSrc(IconMascotOklahoma),
  "texas": mascotSrc(IconMascotTexas),
  "uc-berkeley": mascotSrc(IconMascotUcBerkeley),
  "wake-forest": mascotSrc(IconMascotWakeForest),
};

/** URL of a school's mascot thumbnail, or `null` when it has none. */
export function getSchoolMascot(school: string | undefined | null): string | null {
  return findSchoolAsset(SCHOOL_MASCOT_MAP, school);
}
