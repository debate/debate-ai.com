/**
 * These components render inside a Next.js app, so Next's ambient types are
 * referenced here exactly as an app's generated next-env.d.ts does.
 */
/// <reference types="next" />
/// <reference types="next/image-types/global" />

/**
 * The debate-editor-cardmirror shell imports its stylesheet for its side
 * effects. Bundlers resolve that; a bare `tsc` needs the ambient module
 * declaration.
 */
declare module "*.css";
