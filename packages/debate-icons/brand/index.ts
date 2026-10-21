/**
 * @fileoverview Debate AI brand assets. Import `DebateAiLogo` wherever the
 * wordmark is shown. The app also keeps serving `logo.png` at the site root
 * (`/logo.png`) for links from outside the bundle — see `ROOT_ASSETS` in
 * apps/debate-web/vite.config.ts.
 */

import logo from "./logo.png";

/**
 * The official Debate AI wordmark, 400 × 89 PNG, as a URL string. The
 * bundler may hand back a `StaticImageData` object (`{ src, … }`) instead of
 * a URL, which a plain `<img src>` renders as "[object Object]".
 */
export const DebateAiLogo: string =
  typeof logo === "string" ? logo : (logo as { src: string }).src;
