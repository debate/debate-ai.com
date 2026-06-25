/**
 * Ambient module declarations so a host's `tsc` (which doesn't know how
 * to resolve non-code imports the way Vite does) accepts the side-effect
 * stylesheet import in react/index.tsx.
 */
declare module "*.css";
