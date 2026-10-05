/** Render test for `RoundAccountMarker` (node env, so `react-dom/server` markup). */

import { afterEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { RoundAccountMarker } from "../src/navigation/RoundAccountMarker";
import { recordRoundSavedToAccount, resetFlowAccountStatus } from "../src/state/flowAccountStatus";
import type { Round } from "../src/types/flow";

const round: Round = {
  id: 7,
  tournamentName: "Glenbrooks",
  roundLevel: "Octos",
  debaters: { aff: ["A", "B"], neg: ["C", "D"] },
  judges: [],
  flowIds: [],
  timestamp: 1,
  status: "active",
};

const render = (r: Round) => renderToStaticMarkup(<RoundAccountMarker round={r} />);

afterEach(() => resetFlowAccountStatus());

describe("RoundAccountMarker", () => {
  it("renders nothing without a baseline", () => {
    expect(render(round)).toBe("");
  });

  it("shows saved after the round is saved to the account", () => {
    recordRoundSavedToAccount(round);
    expect(render(round)).toContain("Saved to your account");
  });

  it("flags a round edited since its last account save", () => {
    recordRoundSavedToAccount(round);
    expect(render({ ...round, status: "completed" })).toContain("Changed since last account save");
  });
});
