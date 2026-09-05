/**
 * @fileoverview Tells the two kinds of icon the videos sidebar accepts apart:
 * an image source (an imported SVG/PNG) versus a React component (a Lucide
 * glyph).
 *
 * This existed as an inline `typeof icon === "function"` test in
 * `VideoSidebarTree`, which is wrong: every `lucide-react` icon is built with
 * `React.forwardRef`, so it is an *object* (`{$$typeof, render}`), not a
 * function. The test therefore missed every Lucide icon, and the icon fell
 * through to `next/image`, whose shim resolves the src as
 * `typeof src === "string" ? src : src.src` — `undefined` for a component —
 * and then calls `undefined.startsWith("http://")`. That threw
 * `TypeError: Cannot read properties of undefined (reading 'startsWith')`
 * during render and took the whole `/videos` route down to the error boundary
 * as soon as the Coaching/Research/Practice sections (whose headings use
 * Lucide icons) were added to the sidebar.
 *
 * Discriminating on what an image source actually *is* — a URL string, or a
 * `StaticImageData` object carrying one — is the check that holds, because it
 * does not depend on how React happens to represent a component type.
 * `React.memo`, `forwardRef` and lazy components are all objects too.
 *
 * @module components/category-gallery/tree-item-icon
 */

import type { StaticImageData } from "next/image";
import type { LucideIcon } from "lucide-react";

/** Either an imported image (SVG/PNG) or a Lucide component. */
export type TreeItemIcon = string | StaticImageData | LucideIcon;

/**
 * Whether `icon` is something `next/image` can take as a `src`.
 *
 * @param icon - The icon to classify, or `null`/`undefined` when absent.
 * @returns `true` for a URL string or a `StaticImageData`-shaped object.
 */
export function isImageIcon(
  icon: TreeItemIcon | null | undefined,
): icon is string | StaticImageData {
  if (typeof icon === "string") return icon.length > 0;
  if (typeof icon !== "object" || icon === null) return false;
  return typeof (icon as StaticImageData).src === "string";
}

/**
 * Whether `icon` should be rendered as a React component rather than an image.
 *
 * @param icon - The icon to classify, or `null`/`undefined` when absent.
 * @returns `true` for a function component or any component object
 *   (`forwardRef`, `memo`, `lazy`) that is not a `StaticImageData`.
 */
export function isComponentIcon(
  icon: TreeItemIcon | null | undefined,
): icon is LucideIcon {
  if (icon == null) return false;
  if (isImageIcon(icon)) return false;
  return typeof icon === "function" || typeof icon === "object";
}
