/**
 * Asset imports the bundler resolves and TypeScript does not.
 *
 * Vite/vinext turn a `.css` side-effect import into a stylesheet link and an
 * image import into a URL string, but `tsc` only knows about modules with type
 * declarations — so every one of these was a TS2307/TS2882 error, which is a
 * large part of why this app had no `typecheck` script at all and shipped two
 * genuine runtime faults (`like` imported from nowhere in the admin videos
 * route, a missing `await` on `getAuth()` in the REASON AI route) that `tsc`
 * would have caught. Declaring them here is what makes typechecking this app
 * possible.
 */
declare module "*.css";

declare module "*.svg" {
  const src: string;
  export default src;
}

declare module "*.png" {
  const src: string;
  export default src;
}

declare module "*.jpg" {
  const src: string;
  export default src;
}

declare module "*.webp" {
  const src: string;
  export default src;
}

/** `prismjs` ships JavaScript with no bundled declarations. */
declare module "prismjs";
