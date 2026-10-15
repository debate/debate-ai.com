// Stub for `canvas` — the node-canvas native addon, which can never load in the
// Cloudflare Workers runtime (it is a `.node` binary, and rolldown chokes on it
// at build time: "Could not load .../canvas.node — stream did not contain valid
// UTF-8"). linkedom declares it as an optional peer and reaches for it from
// `commonjs/canvas.cjs`, falling back to its own no-op shim when the require
// throws. Aliasing the bare specifier here IS that fallback, and mirrors what
// linkedom's shim provides: `HTMLCanvasElement` is the only consumer, and it
// only ever calls `createCanvas`.
class Canvas {
  width: number;
  height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  getContext() {
    return null;
  }

  toDataURL() {
    return "";
  }
}

export const createCanvas = (width: number, height: number) => new Canvas(width, height);

export default { createCanvas };
