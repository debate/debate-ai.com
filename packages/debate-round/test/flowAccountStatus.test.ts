import { afterEach, describe, expect, it, vi } from "vitest";
import {
  forgetFlowAccountStatus,
  getFlowAccountStatus,
  getFlowAccountStatusVersion,
  recordFlowSavedToAccount,
  resetFlowAccountStatus,
  subscribeFlowAccountStatus,
} from "../src/state/flowAccountStatus";
import type { Flow } from "../src/types/flow";

function makeFlow(overrides: Partial<Flow> = {}): Flow {
  return {
    content: "1AC",
    level: 0,
    columns: ["1AC", "1NC"],
    invert: false,
    focus: false,
    index: 0,
    lastFocus: [0],
    children: [],
    id: 1,
    ...overrides,
  };
}

afterEach(() => resetFlowAccountStatus());

describe("flowAccountStatus", () => {
  it("is unknown until a save has been recorded this session", () => {
    expect(getFlowAccountStatus(makeFlow())).toBe("unknown");
  });

  it("reports saved while the content matches the last account save", () => {
    const flow = makeFlow();
    recordFlowSavedToAccount(flow);
    expect(getFlowAccountStatus(makeFlow())).toBe("saved");
  });

  it("reports unsaved once the flow is edited after a save", () => {
    recordFlowSavedToAccount(makeFlow());
    expect(getFlowAccountStatus(makeFlow({ content: "1AC (edited)" }))).toBe("unsaved");
  });

  it("tracks flows independently by id", () => {
    recordFlowSavedToAccount(makeFlow({ id: 1 }));
    expect(getFlowAccountStatus(makeFlow({ id: 2 }))).toBe("unknown");
  });

  it("forgets a single flow or everything", () => {
    recordFlowSavedToAccount(makeFlow({ id: 1 }));
    recordFlowSavedToAccount(makeFlow({ id: 2 }));
    forgetFlowAccountStatus(1);
    expect(getFlowAccountStatus(makeFlow({ id: 1 }))).toBe("unknown");
    expect(getFlowAccountStatus(makeFlow({ id: 2 }))).toBe("saved");
    resetFlowAccountStatus();
    expect(getFlowAccountStatus(makeFlow({ id: 2 }))).toBe("unknown");
  });

  it("notifies subscribers and bumps the version only on real changes", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeFlowAccountStatus(listener);
    const before = getFlowAccountStatusVersion();
    recordFlowSavedToAccount(makeFlow());
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getFlowAccountStatusVersion()).toBe(before + 1);
    forgetFlowAccountStatus(999);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    resetFlowAccountStatus();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
