/**
 * @fileoverview The Google-hosted webfonts the app offers.
 *
 * Two stylesheets: every non-system face in the font picker
 * (`UserSettingsPanel`, `state/fontSettings.ts`'s `FONT_OPTIONS`), and the
 * faces the colour themes in `themes.css` name in `--font-sans`/
 * `--font-serif`/`--font-mono` that the first doesn't already cover.
 *
 * They used to be `@import`ed from `app.css`, which made the site's one
 * render-blocking stylesheet wait on fonts.googleapis.com (about 190 kB of
 * `@font-face` rules) before anything painted. Attached as `media="print"`
 * links that switch to `all` once loaded, they no longer block: text paints
 * in the fallback face and swaps (`display=swap`, as before) when the font
 * arrives.
 */

export const WEB_FONT_STYLESHEETS: readonly string[] = [
  "https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400..800;1,400..800&family=Inter:wght@400;500;600;700&family=Lato:wght@400;700&family=Merriweather:wght@400;700&family=Montserrat:wght@400;500;600;700&family=Nunito:wght@400;600;700&family=Open+Sans:wght@400;500;600;700&family=Oswald:wght@400;500;600;700&family=Playfair+Display:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&family=PT+Sans:wght@400;700&family=Raleway:wght@400;500;600;700&family=Roboto:wght@400;500;700&family=Roboto+Mono:wght@400;500;700&family=Roboto+Slab:wght@400;500;700&family=Source+Code+Pro:wght@400;500;700&family=Source+Sans+3:wght@400;500;600;700&family=Ubuntu:wght@400;500;700&display=swap",
  "https://fonts.googleapis.com/css2?family=Architects+Daughter&family=DM+Sans:wght@400;700&family=Fira+Code:wght@400;700&family=Geist:wght@400;700&family=Geist+Mono:wght@400;700&family=IBM+Plex+Mono:wght@400;700&family=JetBrains+Mono:wght@400;700&family=Libre+Baskerville:wght@400;700&family=Lora:wght@400;700&family=Outfit:wght@400;700&family=Oxanium:wght@400;700&family=Plus+Jakarta+Sans:wght@400;700&family=Quicksand:wght@400;700&family=Source+Serif+4:wght@400;700&family=Space+Mono:wght@400;700&family=Ubuntu+Mono:wght@400;700&display=swap",
]

/**
 * Attaches {@link WEB_FONT_STYLESHEETS} to `doc` without blocking render.
 * Idempotent. The root layout inlines the same steps as a head script
 * ({@link webFontsBootstrapScript}) so the request starts before hydration.
 */
export function loadWebFonts(doc: Document = document): void {
  for (const href of WEB_FONT_STYLESHEETS) {
    if (doc.querySelector(`link[data-web-font][href="${href}"]`)) continue
    const link = doc.createElement("link")
    link.rel = "stylesheet"
    link.href = href
    link.media = "print"
    link.setAttribute("data-web-font", "")
    link.onload = () => {
      link.media = "all"
    }
    doc.head.appendChild(link)
  }
}

/** {@link loadWebFonts} as a self-contained script for the document head. */
export function webFontsBootstrapScript(): string {
  return `(function(){var d=document;var h=${JSON.stringify(WEB_FONT_STYLESHEETS)};` +
    `for(var i=0;i<h.length;i++){var l=d.createElement('link');l.rel='stylesheet';l.href=h[i];l.media='print';` +
    `l.setAttribute('data-web-font','');l.onload=function(){this.media='all'};d.head.appendChild(l);}})();`
}
