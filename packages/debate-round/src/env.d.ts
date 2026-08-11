/**
 * These components render inside a Next.js app and pull in the shared icon assets
 * from debate-ui. Referencing Next's ambient types here — exactly as an app's
 * generated next-env.d.ts does — keeps this package type-checkable on its own.
 */
/// <reference types="next" />
/// <reference types="next/image-types/global" />

/**
 * The reason-editor shell imports its stylesheet for its side effects. Bundlers
 * resolve that; a bare `tsc` needs the ambient module declaration.
 */
declare module "*.css";
