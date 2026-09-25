// `?raw` is Vite's raw-text import (used by vinext and Vitest alike).
declare module "*?raw" {
  const content: string;
  export default content;
}
