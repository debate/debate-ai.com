/**
 * @fileoverview A rendered openCaselist bulk-downloads page, trimmed to the
 * parts the parser reads.
 *
 * Captured from `https://opencaselist.com/hspolicy26/downloads` on 2026-09-12.
 * The sidebar's school list and the site chrome are cut — what is kept is
 * verbatim: the CSS-module class names (which change on every deploy, and which
 * the parser must therefore not key on), the sidebar's caselist `<option>`s and
 * school links (hrefs the parser must *not* mistake for archives), the `<h1>`,
 * the two `<h2>` sections, and the archive links themselves.
 *
 * Every caselist — `ndtceda26`, `hsld26`, `hspf26`, `nfald26` — serves this
 * same markup with its own slug substituted, which is what
 * {@link forCaselist} reproduces.
 */

/** The captured HS Policy page. */
export const HSPOLICY_DOWNLOADS_HTML = `<div id="root"><header class="_header_c697o_1 _header-hs-cx_c697o_34 "><h1><a href="/">openCaselist</a></h1><form class="pure-form _search_gkjcs_1 false"><input type="search" placeholder="Search" required="" minlength="3" value=""></form><div class="pure-menu-item _untrusted_c697o_59"><a href="/faq">Account Untrusted</a></div><div class="_menu_c697o_19 pure-menu"><ul><li class="pure-menu-item"><a href="/logout">Logout</a></li></ul></div></header><div class="_wrapper_1rkra_1"><div class="_sidebar_14mwn_1 undefined"><div><form class="form pure-form"><select class="_select_1480k_1" name="year"><option value="2026">2026-2027</option><option value="2025">2025-2026</option></select><select class="_select_1480k_1" name="caselist"><option value="">Choose a Caselist</option><option value="ndtceda26">NDT/CEDA College 2026-27</option><option value="hspolicy26">HS Policy 2026-27</option><option value="hsld26">HS LD 2026-27</option><option value="hspf26">HS PF 2026-27</option><option value="nfald26">NFA College LD 2026-27</option></select></form></div><h2><span>Schools </span></h2><ul><li><a href="/hspolicy26/recent">Recently Modified</a></li><li><a href="/hspolicy26/downloads">Bulk Downloads</a></li></ul><div class="_schools_14mwn_50"><ul><li><a href="/hspolicy26/ADL">ADL (TW)</a></li><li><a href="/hspolicy26/GlenbrookNorth">Glenbrook North (IL)</a></li><li><a href="/hspolicy26/Westminster">Westminster (GA)</a></li></ul></div></div><div class="_main_1rkra_6"><div><div class="_breadcrumbs_erphc_1"><a href="/"></a><a href="/hspolicy26"><span> / hspolicy26</span></a></div><h1>Bulk downloads for HS Policy 2026-27</h1><p><span>Downloads are updated at midnight every Tuesday morning. </span></p><h2>All open source files</h2><p><a href="https://caselist-files.s3.us-east-005.backblazeb2.com/weekly/hspolicy26/hspolicy26-all-2026-09-08.zip">hspolicy26-all-2026-09-08.zip</a></p><h2>Open source files by week</h2><p><a href="https://caselist-files.s3.us-east-005.backblazeb2.com/weekly/hspolicy26/hspolicy26-weekly-2026-09-08.zip">hspolicy26-weekly-2026-09-08.zip</a></p><p><a href="https://caselist-files.s3.us-east-005.backblazeb2.com/weekly/hspolicy26/hspolicy26-weekly-2026-09-01.zip">hspolicy26-weekly-2026-09-01.zip</a></p><p><a href="https://caselist-files.s3.us-east-005.backblazeb2.com/weekly/hspolicy26/hspolicy26-weekly-2026-08-25.zip">hspolicy26-weekly-2026-08-25.zip</a></p><p><a href="https://caselist-files.s3.us-east-005.backblazeb2.com/weekly/hspolicy26/hspolicy26-weekly-2026-08-18.zip">hspolicy26-weekly-2026-08-18.zip</a></p><p><a href="https://caselist-files.s3.us-east-005.backblazeb2.com/weekly/hspolicy26/hspolicy26-weekly-2026-07-07.zip">hspolicy26-weekly-2026-07-07.zip</a></p></div></div></div><footer class="_footer_1p8rc_1 false"><span><a href="https://paperlessdebate.com/donate" rel="noopener noreferrer" target="_blank">Donate</a><a href="/privacy">Privacy Policy</a></span></footer></div>`;

/**
 * The same page as another caselist serves it.
 *
 * @param slug - Caselist slug to substitute, e.g. `ndtceda26`.
 * @param label - The label its `<h1>` carries, e.g. `NDT/CEDA College 2026-27`.
 * @returns The rendered markup for that caselist.
 */
export function forCaselist(slug: string, label: string): string {
  return HSPOLICY_DOWNLOADS_HTML.replaceAll("hspolicy26", slug).replace(
    "Bulk downloads for HS Policy 2026-27",
    `Bulk downloads for ${label}`,
  );
}

/** The client-rendered shell a plain GET of the page returns. */
export const UNRENDERED_SHELL_HTML = `<!doctype html><html lang="en"><head><title>openCaselist</title></head><body><noscript>You need to enable JavaScript to run this app.</noscript><div id="root"></div><script defer="defer" src="/static/js/main.8f2a1c33.js"></script></body></html>`;
