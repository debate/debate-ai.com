/**
 * These components render inside a Next.js app: they use styled-jsx (`<style jsx>`)
 * and import static assets (the SVG/PNG icons re-exported from ./icons). Referencing
 * Next's ambient types here — exactly as an app's generated next-env.d.ts does — keeps
 * this package type-checkable on its own. Redeclaring "*.svg"/"*.png" instead would
 * collide with Next's declarations once the app compiles both.
 */
/// <reference types="next" />
/// <reference types="next/image-types/global" />
