/**
 * @fileoverview Tells an image icon apart from a React component icon.
 *
 * The sidebar accepts both kinds in a single `icon` prop: entries from
 * `ui/icons` are bundler-resolved image assets (a URL string, or a
 * `StaticImageData` object carrying `src`), while `sidebar-tool-sections`
 * uses Lucide components. Only the first kind may be handed to `next/image`
 * — passing a component makes it read `src.src` as undefined and throw
 * "Cannot read properties of undefined (reading 'startsWith')", which took
 * the whole /videos route down.
 *
 * `typeof icon === "function"` is not a safe component test: Lucide builds
 * its icons with `forwardRef`, so they are objects, not functions. Test for
 * the image shapes instead — those are the ones with a fixed contract.
 *
 * @module components/category-gallery/icon-kind
 */

import type { StaticImageData } from "next/image";
import type { LucideIcon } from "lucide-react";

/** Anything the sidebar tree accepts in an `icon` prop. */
export type SidebarIcon = string | StaticImageData | LucideIcon;

/**
 * Whether `icon` is an image source `next/image` can render.
 *
 * @param icon - Icon of either kind, or nothing.
 * @returns `true` for a URL string or a `StaticImageData`-shaped object,
 *   `false` for a React component (including `forwardRef` ones) or a missing
 *   icon.
 */
export function isImageIconSource(icon: SidebarIcon | undefined | null): icon is string | StaticImageData {
  if (typeof icon === "string") return icon.length > 0;
  return typeof icon === "object" && icon !== null && "src" in icon;
}
