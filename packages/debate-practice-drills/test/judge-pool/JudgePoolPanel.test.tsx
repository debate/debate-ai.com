/** @vitest-environment jsdom */
/**
 * @fileoverview The Judge Pool panel: the weekend picker's three-weekend cap,
 * and an organizer filtering the pool and sending a hire request.
 */
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WeekendPicker } from "../../src/judge-pool/ui/JudgeListingForm";
import { JudgePoolPanel } from "../../src/judge-pool/ui/JudgePoolPanel";
import type { JudgePoolResponse } from "../../src/judge-pool/types";
import { bodyText, button, change, cleanup, click, flush, mockFetch, mount, submit } from "../helpers/panel-dom";

function Picker() {
  const [selected, setSelected] = useState<string[]>([]);
  return <WeekendPicker selected={selected} onChange={setSelected} today="2026-10-12" />;
}

const checkboxes = () => [...document.querySelectorAll<HTMLButtonElement>('[role="checkbox"]')];

const POOL: JudgePoolResponse = {
  viewer: { id: "organizer", name: "Organizer", imageUrl: null },
  listing: null,
  pool: [
    {
      active: true,
      weekends: ["2026-10-17", "2026-11-21"],
      states: ["CA"],
      canTravel: false,
      formats: ["ld"],
      philosophy: "Tech over truth.",
      judge: { id: "judge-ca", name: "Casey Judge", imageUrl: null },
      updatedAt: 1,
    },
    {
      active: true,
      weekends: ["2026-11-21"],
      states: ["NY"],
      canTravel: false,
      formats: ["pf"],
      philosophy: "",
      judge: { id: "judge-ny", name: "Nico Judge", imageUrl: null },
      updatedAt: 2,
    },
  ],
  hires: [],
  paymentsConnected: false,
};

describe("WeekendPicker", () => {
  afterEach(cleanup);

  it("lists upcoming weekends with their majors and stops at three", () => {
    mount(<Picker />);
    expect(checkboxes()[0].textContent).toContain("Oct 17–18");
    expect(checkboxes()[0].textContent).toContain("Heart of Texas");
    for (const box of checkboxes().slice(0, 3)) click(box);
    expect(checkboxes().filter((box) => box.getAttribute("aria-checked") === "true")).toHaveLength(3);
    expect(checkboxes()[3].disabled).toBe(true);
    click(checkboxes()[0]);
    expect(checkboxes()[3].disabled).toBe(false);
  });
});

describe("JudgePoolPanel", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-12T12:00:00Z"));
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("filters the pool by state and sends a hire request", async () => {
    const { calls } = mockFetch([
      { method: "POST", match: "/api/judge-pool/hires", status: 201, respond: {} },
      { method: "GET", match: "/api/judge-pool", respond: POOL },
    ]);
    mount(<JudgePoolPanel />);
    await flush();

    expect(bodyText()).toContain("Casey Judge");
    expect(bodyText()).toContain("Nico Judge");
    expect(bodyText()).toContain("Payment isn't handled on the site yet");

    change(document.querySelector('select[aria-label="Tournament state"]')!, "NY");
    expect(bodyText()).not.toContain("Casey Judge");
    change(document.querySelector('select[aria-label="Tournament state"]')!, "");

    const casey = [...document.querySelectorAll("li")].find((li) => li.textContent?.includes("Casey Judge"))!;
    click(button(/^Hire$/, casey));
    change(document.querySelector("#hire-judge-ca-tournament")!, "Bay Area Invitational");
    change(document.querySelector("#hire-judge-ca-offer")!, "$300");
    submit(document.querySelector("#hire-judge-ca-tournament")!.closest("form")!);
    await flush();

    const post = calls.find((call) => call.method === "POST");
    expect(post?.body).toMatchObject({
      judgeId: "judge-ca",
      tournamentName: "Bay Area Invitational",
      weekend: "2026-10-17",
      offer: "$300",
    });
  });
});
