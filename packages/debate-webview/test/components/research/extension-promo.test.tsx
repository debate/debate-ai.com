import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import {
  EXTENSION_FEATURES,
  ExtensionFeatures,
  ExtensionInstallLink,
} from "../../../src/components/research/ExtensionPromo";
import { EXTENSION_ID, EXTENSION_STORE_URL } from "../../../src/lib/config/site";

describe("Research Workspace extension promo", () => {
  it("points the install button at the extension's Chrome Web Store listing", () => {
    expect(EXTENSION_STORE_URL).toBe(`https://chromewebstore.google.com/detail/${EXTENSION_ID}`);

    const html = renderToStaticMarkup(<ExtensionInstallLink />);
    expect(html).toContain(`href="${EXTENSION_STORE_URL}"`);
    expect(html).toContain('target="_blank"');
    expect(html).toContain("Chrome extension");
  });

  it("lists every extension feature", () => {
    const html = renderToStaticMarkup(<ExtensionFeatures />);
    expect(html).toContain(`href="${EXTENSION_STORE_URL}"`);
    for (const feature of EXTENSION_FEATURES) {
      expect(html).toContain(feature.replace(/'/g, "&#x27;"));
    }
  });
});
