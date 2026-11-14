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
import { listContributions } from "../src/state/contributions";
import { click, mount, type } from "./helpers/mount";
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

describe("ContributionsFeedPanel Contributor ID from the signed-in account", () => {
  const contributorInput = () =>
    view.container.querySelector<HTMLInputElement>("#contribution-contributor")!;
  const accountNote = () => view.container.querySelector("#contribution-contributor-note");
  const submitButton = () =>
    Array.from(view.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Submit contribution",
    )!;

  it("starts on the signed-in id and says it came from the account", async () => {
    view = await mount(<ContributionsFeedPanel signedInContributorId="acct-jane" />);

    expect(contributorInput().value).toBe("acct-jane");
    expect(accountNote()?.textContent).toBe("Filled in from your account.");
    expect(contributorInput().getAttribute("aria-describedby")).toBe("contribution-contributor-note");
  });

  it("saves a contribution under the signed-in id without typing one", async () => {
    view = await mount(<ContributionsFeedPanel signedInContributorId="acct-jane" />);

    await click(submitButton());

    expect(listContributions().map((c) => c.contributorId)).toEqual(["acct-jane"]);
    expect(view.container.textContent).not.toContain("Contributor ID is required.");
    // The box goes back to the account id for the next submission.
    expect(contributorInput().value).toBe("acct-jane");
  });

  it("stays editable, and a later session update does not overwrite an edit", async () => {
    view = await mount(<ContributionsFeedPanel signedInContributorId="acct-jane" />);

    await type(contributorInput(), "team-captain");
    expect(contributorInput().value).toBe("team-captain");
    expect(accountNote()?.textContent).toBe("Your account's ID is acct-jane.");

    await view.rerender(<ContributionsFeedPanel signedInContributorId="acct-jane-2" />);
    expect(contributorInput().value).toBe("team-captain");

    await click(submitButton());
    expect(listContributions().map((c) => c.contributorId)).toEqual(["team-captain"]);
    // After the submit the edit is spent: the box is back on the account id.
    expect(contributorInput().value).toBe("acct-jane-2");
  });

  it("fills in once the session arrives after mount", async () => {
    view = await mount(createElement(ContributionsFeedPanel));
    expect(contributorInput().value).toBe("");

    await view.rerender(<ContributionsFeedPanel signedInContributorId="acct-late" />);
    expect(contributorInput().value).toBe("acct-late");
  });

  it("signed out, starts empty and still requires an id", async () => {
    view = await mount(createElement(ContributionsFeedPanel));

    expect(contributorInput().value).toBe("");
    expect(accountNote()).toBeNull();

    await click(submitButton());
    expect(view.container.textContent).toContain("Contributor ID is required.");
    expect(listContributions()).toEqual([]);
  });
});
