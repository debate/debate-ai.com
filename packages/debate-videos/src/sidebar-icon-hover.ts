/**
 * @fileoverview Entry point for the random icon animation on its own, so a
 * page that only needs it (the docs toolbar) doesn't pull in the whole
 * package. See `ui/layout/sidebar-icon-hover`.
 * @module sidebar-icon-hover
 */
export {
  playRandomIconAnimation,
  readSidebarIconAnimations,
} from "./ui/layout/sidebar-icon-hover"
