/**
 * This package renders inside a Next.js app and, through its dependencies,
 * pulls in image assets (`@debate-ai/rankings` school logos). Referencing
 * Next's ambient types — as an app's generated next-env.d.ts does — keeps it
 * type-checkable on its own.
 */
/// <reference types="next" />
/// <reference types="next/image-types/global" />

/**
 * The file manager and the Debate Editor import stylesheets for their side
 * effects. Bundlers resolve those; a bare `tsc` needs the ambient declaration.
 */
declare module "*.css";
