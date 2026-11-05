import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { LegalDocument } from "../../../src/routes/legal/privacy/legal-document";

const props = {
  appName: "Debate AI",
  contactEmail: "support@debate-ai.com",
  lastRevisedDate: "2026-11-05",
  homeUrl: "/",
};

describe("Terms of Service and Privacy Policy", () => {
  it("adds the school trademarks section after the shared full text", () => {
    const html = renderToStaticMarkup(<LegalDocument {...props} />);
    expect(html).toContain("18. How to Contact Us");
    expect(html).toContain("19. School Names, Logos, and Trademarks");
    expect(html.indexOf("19. School Names")).toBeGreaterThan(html.indexOf("18. How to Contact Us"));
    expect(html).toContain("displayed on Debate AI are the property of their respective owners");
    expect(html).toContain("Debate AI is an independent service and is not affiliated with");
    expect(html).toContain("Nothing in these Terms grants users any rights to use third-party trademarks.");
    expect(html).not.toContain("[App Name]");
  });

  it("shows the short version in the plain-language summary", () => {
    const html = renderToStaticMarkup(<LegalDocument {...props} defaultVariant="summary" />);
    expect(html).toContain("School names and logos");
    expect(html).toContain(
      "is not affiliated with, sponsored by, or endorsed by the institutions shown.",
    );
    expect(html).not.toContain("19. School Names");
  });
});
