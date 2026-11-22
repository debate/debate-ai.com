/** Bundlers hand back a URL string (Vite) or `{ src }` (Next) for an imported png. */
declare module "*.png" {
  const image: string | { src: string }
  export default image
}
