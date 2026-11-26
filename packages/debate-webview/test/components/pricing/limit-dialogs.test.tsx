/** @vitest-environment jsdom */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const bus = vi.hoisted(() => {
  const state = {
    planLimit: null as null | ((metric: string) => void),
    aiKeyNeeded: null as null | (() => void),
    subscription: null as null | (() => void),
  };
  return {
    state,
    watchPlanLimits: vi.fn(() => vi.fn()),
    unwatchPlanLimits: vi.fn(),
    subscribeToPlanLimits: vi.fn((cb: (metric: string) => void) => {
      state.planLimit = cb;
      return vi.fn();
    }),
    attachOwnAiKey: vi.fn(() => vi.fn()),
    subscribeToAiKeyNeeded: vi.fn((cb: () => void) => {
      state.aiKeyNeeded = cb;
      return vi.fn();
    }),
    subscribeToSubscriptionDialog: vi.fn((cb: () => void) => {
      state.subscription = cb;
      return vi.fn();
    }),
  };
});

vi.mock("../../../src/lib/stripe/plan-limit", () => ({
  watchPlanLimits: bus.watchPlanLimits,
  subscribeToPlanLimits: bus.subscribeToPlanLimits,
}));
vi.mock("../../../src/lib/ai/own-ai-key", () => ({
  attachOwnAiKey: bus.attachOwnAiKey,
  subscribeToAiKeyNeeded: bus.subscribeToAiKeyNeeded,
}));
vi.mock("../../../src/lib/stripe/subscription-dialog", () => ({
  subscribeToSubscriptionDialog: bus.subscribeToSubscriptionDialog,
}));
vi.mock("../../../src/components/pricing/PricingPlans", () => ({
  PricingPlans: ({ info }: { info: { plans: unknown[] } }) => <div data-testid="plans">{info.plans.length} plans</div>,
}));
vi.mock("../../../src/components/settings/sections/OwnAiKeySection", () => ({
  OwnAiKeyForm: ({ onSaved }: { onSaved?: () => void }) => (
    <button type="button" data-testid="key-form" onClick={onSaved}>
      key form
    </button>
  ),
}));

import { OwnAiKeyDialog } from "../../../src/components/pricing/OwnAiKeyDialog";
import { PlanLimitDialog } from "../../../src/components/pricing/PlanLimitDialog";
import { SubscriptionDialog } from "../../../src/components/pricing/SubscriptionDialog";
import { act } from "react";
import { bodyText, click, cleanup, flush, installDomShims, mockFetch, mount } from "../../helpers/dom";

beforeAll(() => installDomShims());
beforeEach(() => {
  bus.state.planLimit = null;
  bus.state.aiKeyNeeded = null;
  bus.state.subscription = null;
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const info = (plans = 2, usage: object | null = { llmRequests: 12, cardAiAnalyses: 3, cardSearches: 7 }) => ({
  plans: Array.from({ length: plans }, (_, i) => ({ id: `p${i}` })),
  usage,
});

const subscriptionRoute = (respond: unknown, status = 200) => mockFetch([{ match: "/api/stripe/subscription", respond, status }]);

async function fire(callback: ((arg: never) => void) | null, ...args: unknown[]) {
  await act(async () => {
    (callback as (...a: unknown[]) => void)(...args);
  });
  await flush();
}

const testId = (id: string) => document.querySelector(`[data-testid=${id}]`);

describe("PlanLimitDialog", () => {
  it("renders nothing and fetches nothing until a plan limit is hit", async () => {
    const { calls } = subscriptionRoute(info());
    mount(<PlanLimitDialog />);
    await flush();
    expect(document.querySelector("[role=dialog]")).toBeNull();
    expect(calls).toHaveLength(0);
    expect(bus.watchPlanLimits).toHaveBeenCalledTimes(1);
  });

  it("opens with the plans, today's usage and the own-key option when an AI limit is hit", async () => {
    subscriptionRoute(info());
    mount(<PlanLimitDialog />);
    await fire(bus.state.planLimit, "llmRequests");
    expect(bodyText()).toContain("You've reached today's AI requests limit");
    expect(bodyText()).toContain("Today: 12 AI requests · 3 card AI analyses · 7 card searches.");
    expect(testId("plans")?.textContent).toBe("2 plans");
    expect(testId("key-form")).not.toBeNull();
  });

  it("names the card analyses limit and leaves out the usage line without usage data", async () => {
    subscriptionRoute(info(1, null));
    mount(<PlanLimitDialog />);
    await fire(bus.state.planLimit, "cardAiAnalyses");
    expect(bodyText()).toContain("card AI analyses limit");
    expect(bodyText()).not.toContain("Today:");
  });

  it("does not offer an own AI key for the card search limit", async () => {
    subscriptionRoute(info());
    mount(<PlanLimitDialog />);
    await fire(bus.state.planLimit, "cardSearches");
    expect(bodyText()).toContain("card searches limit");
    expect(testId("key-form")).toBeNull();
    expect(testId("plans")).not.toBeNull();
  });

  it.each([
    ["the response is an error", () => subscriptionRoute({ error: "x" }, 500)],
    ["there are no plans to sell", () => subscriptionRoute(info(0))],
    [
      "the request fails",
      () => {
        globalThis.fetch = vi.fn(async () => {
          throw new TypeError("offline");
        }) as unknown as typeof fetch;
      },
    ],
  ])("stays closed when %s", async (_name, arrange) => {
    arrange();
    mount(<PlanLimitDialog />);
    await fire(bus.state.planLimit, "llmRequests");
    expect(document.querySelector("[role=dialog]")).toBeNull();
  });

  it("closes from the dialog's close button", async () => {
    subscriptionRoute(info());
    mount(<PlanLimitDialog />);
    await fire(bus.state.planLimit, "llmRequests");
    click(document.querySelector<HTMLButtonElement>("[role=dialog] button[class*=absolute], [role=dialog] button:has(.sr-only)")!);
    await flush();
    expect(document.querySelector("[role=dialog]")).toBeNull();
  });
});

describe("OwnAiKeyDialog", () => {
  it("attaches the key wrapper on mount and stays closed", async () => {
    const { calls } = subscriptionRoute(info());
    mount(<OwnAiKeyDialog />);
    await flush();
    expect(bus.attachOwnAiKey).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[role=dialog]")).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("offers an upgrade and a key when the shared key hits its limit and plans load", async () => {
    subscriptionRoute(info());
    mount(<OwnAiKeyDialog />);
    await fire(bus.state.aiKeyNeeded);
    expect(bodyText()).toContain("AI limit reached");
    expect(bodyText()).toContain("Upgrade your account or bring your own key");
    expect(bodyText()).toContain("Or bring your own key");
    expect(document.querySelector("[data-option=upgrade]")).not.toBeNull();
    expect(testId("plans")).not.toBeNull();
  });

  it("offers only the key when the plans cannot be loaded", async () => {
    subscriptionRoute({ error: "x" }, 500);
    mount(<OwnAiKeyDialog />);
    await fire(bus.state.aiKeyNeeded);
    expect(bodyText()).toContain("Add your own key to keep going");
    expect(bodyText()).toContain("Bring your own key");
    expect(bodyText()).not.toContain("Or bring your own key");
    expect(document.querySelector("[data-option=upgrade]")).toBeNull();
  });

  it("closes once a key is saved", async () => {
    subscriptionRoute(info(0));
    mount(<OwnAiKeyDialog />);
    await fire(bus.state.aiKeyNeeded);
    click(testId("key-form")!);
    await flush();
    expect(document.querySelector("[role=dialog]")).toBeNull();
  });

  it("falls back to the key option when the request throws", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("offline");
    }) as unknown as typeof fetch;
    mount(<OwnAiKeyDialog />);
    await fire(bus.state.aiKeyNeeded);
    expect(document.querySelector("[data-option=upgrade]")).toBeNull();
    expect(document.querySelector("[data-option=own-key]")).not.toBeNull();
  });
});

describe("SubscriptionDialog", () => {
  it("opens on request with usage, plans and the key form", async () => {
    subscriptionRoute(info());
    mount(<SubscriptionDialog />);
    await flush();
    expect(document.querySelector("[role=dialog]")).toBeNull();
    await fire(bus.state.subscription);
    expect(bodyText()).toContain("Upgrade your subscription");
    expect(bodyText()).toContain("Today: 12 AI requests · 3 card AI analyses · 7 card searches. Limits reset at midnight UTC.");
    expect(testId("plans")).not.toBeNull();
    expect(testId("key-form")).not.toBeNull();
  });

  it("hides the plan picker when no plans load but still offers the key", async () => {
    subscriptionRoute(info(0, null));
    mount(<SubscriptionDialog />);
    await fire(bus.state.subscription);
    expect(testId("plans")).toBeNull();
    expect(bodyText()).not.toContain("Today:");
    expect(testId("key-form")).not.toBeNull();
  });

  it("closes once a key is saved, and survives a failed fetch", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("offline");
    }) as unknown as typeof fetch;
    mount(<SubscriptionDialog />);
    await fire(bus.state.subscription);
    expect(testId("plans")).toBeNull();
    click(testId("key-form")!);
    await flush();
    expect(document.querySelector("[role=dialog]")).toBeNull();
  });
});
