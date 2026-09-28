// @vitest-environment jsdom
/**
 * @fileoverview Render test for `ContributionsFeedPanel`'s header
 * `description` — the tools-page-wide "mini guide" convention `PanelShell`
 * renders under every panel's title. This panel previously never set one:
 * the explanation of what the panel does lived only in an inline paragraph
 * (which also carried a helpfulness-score tooltip and so couldn't move into
 * the plain-string `description` prop wholesale), leaving the header itself
 * with a bare title.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createElement } from "react";

import { ContributionsFeedPanel } from "../src/panels/ContributionsFeedPanel";
import { mount } from "./helpers/mount";
import type { Mounted } from "./helpers/mount";

let view: Mounted;

beforeEach(() => {
  localStorage.clear();
});

afterEach(async () => {
  await view?.unmount();
  localStorage.clear();
});

describe("ContributionsFeedPanel description", () => {
  it("shows the panel's mini-guide description in the header", async () => {
    view = await mount(createElement(ContributionsFeedPanel));

    expect(view.container.textContent).toContain(
      "Submit, like, save, and endorse the community's cards, summaries, highlights, and annotations.",
    );
    // The inline paragraph's own wording no longer repeats the header's —
    // it now only carries the ranking-metric explanation.
    expect(view.container.textContent).toContain("Ranked by blended");
  });
});
