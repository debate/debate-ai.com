import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FileStatBadges } from "../../src/docs/FileStatBadges";

describe("FileStatBadges", () => {
  it("shows quote and block counts as badges", () => {
    const html = renderToStaticMarkup(<FileStatBadges quoteCount={9} blockCount={1200} />);
    expect(html).toContain('aria-label="9 quotes"');
    expect(html).toContain('aria-label="1200 blocks"');
    expect(html).toContain("1,200");
  });

  it("hides a zero or uncounted badge", () => {
    const html = renderToStaticMarkup(<FileStatBadges quoteCount={1} blockCount={0} />);
    expect(html).toContain('aria-label="1 quote"');
    expect(html).not.toContain("file-block-badge");
    expect(renderToStaticMarkup(<FileStatBadges quoteCount={null} blockCount={undefined} />)).toBe("");
  });
});
