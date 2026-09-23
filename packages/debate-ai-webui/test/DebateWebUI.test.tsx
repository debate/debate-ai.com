import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { DebateWebUI } from "../src/DebateWebUI";
import { BUILT_IN_SCREENS } from "../src/screens";
import type { WebUIScreen } from "../src/types";

/** A host-supplied screen, the way the extension appends its settings. */
const extensionScreen: WebUIScreen = {
  id: "extension",
  label: "Extension",
  description: "Settings that belong to the host, not the app.",
  render: () => <p>host settings</p>,
};

describe("DebateWebUI", () => {
  it("lists every built-in screen in the nav", () => {
    const html = renderToStaticMarkup(<DebateWebUI />);
    for (const screen of BUILT_IN_SCREENS) {
      expect(html).toContain(`>${screen.label}<`);
    }
  });

  it("opens on the first screen when no initial id is given", () => {
    const html = renderToStaticMarkup(<DebateWebUI />);
    expect(html).toContain(BUILT_IN_SCREENS[0]!.description);
  });

  it("appends a host's own screens after the built-in ones and renders them", () => {
    const html = renderToStaticMarkup(
      <DebateWebUI extraScreens={[extensionScreen]} initialScreenId="extension" />,
    );
    expect(html).toContain("host settings");
    expect(html).toContain(extensionScreen.description);
    // Appended, not prepended: the app's screens stay first in the nav.
    expect(html.indexOf(">Extension<")).toBeGreaterThan(html.indexOf(">Videos<"));
  });

  it("falls back to the first screen for an id that no longer exists", () => {
    // A host can persist a selection and then stop supplying that screen; the
    // panel should not go blank.
    const html = renderToStaticMarkup(<DebateWebUI initialScreenId="gone" />);
    expect(html).toContain(BUILT_IN_SCREENS[0]!.description);
  });

  it("shows the configured deployment's host, not the production default", () => {
    const html = renderToStaticMarkup(<DebateWebUI origin="http://localhost:3000" />);
    expect(html).toContain("localhost:3000");
    expect(html).not.toContain("debate-ai.com");
  });

  it("keeps the host's className alongside its own root class", () => {
    const html = renderToStaticMarkup(<DebateWebUI className="options-ui" />);
    expect(html).toContain('class="dai-root options-ui"');
  });
});
