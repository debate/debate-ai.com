import tailwindcss from "@tailwindcss/postcss"

/**
 * react-reason-editor's stylesheet bundles KaTeX's CSS with all twenty KaTeX
 * faces inlined as base64 in three formats each (woff2, woff, ttf) — 2.9 MB
 * of its 3.3 MB. The /doc workspace that loads it also imports
 * `katex/dist/katex.min.css`, which declares the same faces as separate font
 * files the browser only fetches when a formula needs them, so the inlined
 * copies are dropped.
 *
 * @type {import("postcss").Plugin}
 */
const dropInlinedKatexFonts = {
  postcssPlugin: "drop-inlined-katex-fonts",
  AtRule: {
    "font-face": (rule) => {
      let family = ""
      let src = ""
      rule.each((node) => {
        if (node.type !== "decl") return
        if (node.prop === "font-family") family = node.value
        if (node.prop === "src") src = node.value
      })
      if (/^["']?KaTeX_/.test(family) && src.includes("data:")) rule.remove()
    },
  },
}

/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: [tailwindcss(), dropInlinedKatexFonts],
}

export default config
