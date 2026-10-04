/**
 * Render test for `FlowTab`'s account-save marker. Vitest runs in `node`, so
 * this asserts on `react-dom/server` markup, as `FlowHistoryList.test.tsx` does.
 */

import { afterEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { FlowTab } from "../src/navigation/FlowTab";
import { recordFlowSavedToAccount, resetFlowAccountStatus } from "../src/state/flowAccountStatus";
import type { Flow } from "../src/types/flow";

const flow: Flow = {
  content: "1AC",
  level: 0,
  columns: ["1AC", "1NC"],
  invert: false,
  focus: false,
  index: 0,
  lastFocus: [0],
  children: [],
  id: 1,
};

const render = (f: Flow) => renderToStaticMarkup(<FlowTab flow={f} selected={false} onClick={() => {}} />);

afterEach(() => resetFlowAccountStatus());

describe("FlowTab account-save marker", () => {
  it("shows nothing when no save baseline exists", () => {
    const html = render(flow);
    expect(html).not.toContain("Saved to your account");
    expect(html).not.toContain("Changed since last account save");
  });

  it("shows a saved marker after the flow is saved to the account", () => {
    recordFlowSavedToAccount(flow);
    expect(render(flow)).toContain("Saved to your account");
  });

  it("flags a flow edited since its last account save", () => {
    recordFlowSavedToAccount(flow);
    expect(render({ ...flow, content: "1AC v2" })).toContain("Changed since last account save");
  });
});
