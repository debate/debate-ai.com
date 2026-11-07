/**
 * @fileoverview School mascot illustrations, one per college, as small webp
 * thumbnails (640px wide) of the full-size pngs in `mascots/`. Name lookups
 * go through `getSchoolMascot` in `debate-rankings`; a test there fails if a
 * thumbnail is left unexported or unmapped.
 *
 * `mascots/harvard.png` is a copy of the Dartmouth art, so Harvard has no
 * thumbnail until a real one is added.
 */

export { default as IconMascotDartmouth } from "./mascots/thumbs/dartmouth.webp";
export { default as IconMascotEmory } from "./mascots/thumbs/emory.webp";
export { default as IconMascotGeorgetown } from "./mascots/thumbs/georgetown.webp";
export { default as IconMascotIowa } from "./mascots/thumbs/iowa.webp";
export { default as IconMascotKansas } from "./mascots/thumbs/kansas.webp";
export { default as IconMascotMichigan } from "./mascots/thumbs/michigan.webp";
export { default as IconMascotMichiganState } from "./mascots/thumbs/michigan-state.webp";
export { default as IconMascotNorthwestern } from "./mascots/thumbs/northwestern.webp";
export { default as IconMascotOklahoma } from "./mascots/thumbs/oklahoma.webp";
export { default as IconMascotTexas } from "./mascots/thumbs/texas.webp";
export { default as IconMascotUcBerkeley } from "./mascots/thumbs/uc-berkeley.webp";
export { default as IconMascotWakeForest } from "./mascots/thumbs/wake-forest.webp";
