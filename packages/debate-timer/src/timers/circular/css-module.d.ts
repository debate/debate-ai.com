/**
 * CircularTimerFace imports its stylesheet for its side effects. Bundlers
 * resolve that; a bare `tsc` needs the ambient module declaration. The face
 * references this file itself, so every package that type-checks it (through
 * @debate-ai/timer's index) picks the declaration up too.
 */
declare module "*.css";
