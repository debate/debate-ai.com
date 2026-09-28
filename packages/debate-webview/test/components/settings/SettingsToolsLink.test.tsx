import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { SettingsToolsLink } from "../../../src/components/settings/SettingsToolsLink";

describe("SettingsToolsLink", () => {
  it("links to /tools", () => {
    const html = renderToStaticMarkup(<SettingsToolsLink />);

    expect(html).toContain('href="/tools"');
  });

  it("explains what moved to the Tools page", () => {
    const html = renderToStaticMarkup(<SettingsToolsLink />);

    expect(html).toContain("Find them on the Tools page.");
  });
});
