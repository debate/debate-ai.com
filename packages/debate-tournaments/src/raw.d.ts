// Vite's `?raw` suffix inlines a file's text as a string (the demo seed in
// host/demo.ts). Vitest and the app's vinext build both understand it.
declare module "*?raw" {
  const text: string;
  export default text;
}
