/**
 * `chromeHost()` is what keeps CardMirror's page-owning chrome (the
 * full-window home hub, the crash-recovery sidebar) inside the host page's
 * column instead of over its sidebar: `embed-containment.css` re-pins that
 * chrome with `.dec-cardmirror-embed <selector>` DESCENDANT rules, so chrome
 * appended to `document.body` — outside the embed — is unreachable by them
 * and paints across the whole viewport.
 */

import { describe, expect, it, afterEach } from "vitest";
import { chromeHost } from "../src/editor/chrome-host.js";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("chromeHost", () => {
  it("falls back to <body> in a page-owning deployment", () => {
    expect(chromeHost()).toBe(document.body);
  });

  it("returns the engine container when CardMirror is embedded", () => {
    const embed = document.createElement("div");
    embed.className = "dec-cardmirror-embed";
    const root = document.createElement("div");
    root.className = "dec-cardmirror-root";
    embed.appendChild(root);
    document.body.appendChild(embed);

    expect(chromeHost()).toBe(root);
  });

  it("keeps chrome inside the embed, so the containment rules can reach it", () => {
    const embed = document.createElement("div");
    embed.className = "dec-cardmirror-embed";
    const root = document.createElement("div");
    root.className = "dec-cardmirror-root";
    embed.appendChild(root);
    document.body.appendChild(embed);

    const hub = document.createElement("div");
    hub.className = "pmd-home-screen";
    chromeHost().appendChild(hub);

    expect(embed.contains(hub)).toBe(true);
    expect(document.querySelector(".dec-cardmirror-embed .pmd-home-screen")).toBe(hub);
  });

  it("hands back the node the singleton re-parents, so chrome travels with it", () => {
    // The React singleton creates `.dec-cardmirror-root` on <body> before it
    // imports the engine, then moves that same node into whichever
    // <CardMirrorEditor> claims it. Chrome mounted into the container at boot
    // therefore lands inside the embed without a second move.
    const root = document.createElement("div");
    root.className = "dec-cardmirror-root";
    document.body.appendChild(root);

    const hub = document.createElement("div");
    hub.className = "pmd-home-screen";
    chromeHost().appendChild(hub);

    const embed = document.createElement("div");
    embed.className = "dec-cardmirror-embed";
    document.body.appendChild(embed);
    embed.appendChild(root);

    expect(embed.contains(hub)).toBe(true);
  });
});
