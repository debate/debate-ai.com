// @vitest-environment jsdom
/**
 * @fileoverview CaselistMarkdown: openCaselist cite text rendered without innerHTML.
 */
import { afterEach, describe, expect, it } from "vitest";
import { CaselistMarkdown } from "../src/leaderboard/profile/CaselistMarkdown";
import { mount, type Mounted } from "./helpers/mount";

let view: Mounted | undefined;
afterEach(async () => {
  await view?.unmount();
  view = undefined;
});

describe("CaselistMarkdown", () => {
  it("renders headings, bold, italics, links and paragraphs", async () => {
    view = await mount(
      <CaselistMarkdown text={"# 1AC\n**Smith 21** _Prof_\nsee [source](https://example.com/a)\n\nhttps://example.org/b"} />,
    );
    const root = view.container;
    expect(root.querySelectorAll("p")).toHaveLength(3);
    expect(root.querySelector("strong")?.textContent).toBe("Smith 21");
    expect(root.querySelector("em")?.textContent).toBe("Prof");
    expect(root.querySelector('a[href="https://example.com/a"]')?.textContent).toBe("source");
    expect(root.querySelector('a[href="https://example.org/b"]')).not.toBeNull();
  });

  it("keeps unsafe link targets as text", async () => {
    view = await mount(<CaselistMarkdown text={"[x](javascript:alert(1)) <b>raw</b>"} />);
    expect(view.container.querySelector("a")).toBeNull();
    expect(view.container.querySelector("b")).toBeNull();
    expect(view.container.textContent).toContain("<b>raw</b>");
  });
});
