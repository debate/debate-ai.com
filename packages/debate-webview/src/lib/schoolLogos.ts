/**
 * @fileoverview School logo lookup. Re-exports the one canonical map in
 * `@debate-ai/rankings`, so a logo added there (and its other spellings)
 * shows everywhere a school name is drawn.
 */

export {
  SCHOOL_LOGO_MAP,
  getSchoolLogo,
  hasSchoolLogo,
} from "@debate-ai/rankings/src/leaderboard/lib/schoolLogos";
