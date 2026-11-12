/** @vitest-environment jsdom */
/**
 * @fileoverview The Preferences "Team" box asks for the coach's roster, and
 * only asks for the coach-only assignments list when the account has the
 * Research Team plan (`max > 0`), so non-coaches see no 403s.
 */
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { TeamCoachingSection } from "../../../src/components/settings/sections/TeamCoachingSection";
import { bodyText, cleanup, flush, installDomShims, mockFetch, mount } from "../../helpers/dom";

beforeAll(() => installDomShims());
afterEach(() => cleanup());

describe("TeamCoachingSection", () => {
  it("renders nothing and skips the assignments list without the plan", async () => {
    const { calls } = mockFetch([
      { match: "/api/team/students", respond: { students: [], max: 0 } },
      { match: "/api/team/my-assignments", respond: { assignments: [] } },
    ]);
    mount(<TeamCoachingSection />);
    await flush();
    expect(calls.some((call) => call.url === "/api/team/assignments")).toBe(false);
    expect(bodyText()).toBe("");
  });

  it("loads the roster and assignments for a coach", async () => {
    const { calls } = mockFetch([
      { match: "/api/team/students", respond: { students: ["s@x.com"], max: 10 } },
      { match: "/api/team/my-assignments", respond: { assignments: [] } },
      { match: "/api/team/assignments", respond: { assignments: [], limits: { lessonPlans: 5, practiceDrills: 5 } } },
    ]);
    mount(<TeamCoachingSection />);
    await flush();
    await flush();
    expect(calls.some((call) => call.url === "/api/team/assignments")).toBe(true);
    expect(bodyText()).toContain("s@x.com");
  });
});
