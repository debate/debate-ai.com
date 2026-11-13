// @vitest-environment jsdom
/**
 * The Round Info dialog: scouting fields, the decision toggle and the
 * paste-a-pairing autofill with its overwrite confirmation.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import InfoPanel from "../src/components/flow/InfoPanel";
import { makeFlowRound } from "../src/lib/model/flow";
import { useFlowStore } from "../src/lib/store/useFlowStore";

import { click, flush, mount, typeInto, type Mounted } from "./helpers/mount";

const PAIRING = "Round 3 of Varsity Policy";

let mounted: Mounted | undefined;
const $ = <T extends Element = HTMLElement>(testid: string) => document.querySelector<T>(`[data-testid=${testid}]`)!;
const scouting = () => useFlowStore.getState().round!.scouting;

async function paste(text: string) {
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: { getData: () => text } });
    await flush(() => $("scout-paste").dispatchEvent(event));
}

beforeEach(async () => {
    useFlowStore.setState({ round: makeFlowRound({ event: "policy" }), infoOpen: true });
    mounted = await mount(<InfoPanel />);
});

afterEach(async () => {
    await mounted?.unmount();
    mounted = undefined;
    document.body.innerHTML = "";
});

describe("InfoPanel", () => {
    it("renders nothing while closed or without a round", async () => {
        await flush(() => useFlowStore.setState({ infoOpen: false }));
        expect(document.querySelector("[data-testid=info-panel]")).toBeNull();
        await flush(() => useFlowStore.setState({ infoOpen: true, round: null }));
        expect(document.querySelector("[data-testid=info-panel]")).toBeNull();
    });

    it("writes every scouting field into the round", async () => {
        await typeInto($<HTMLInputElement>("scout-affSchool"), "Westside");
        await typeInto($<HTMLInputElement>("scout-negSchool"), "Eastside");
        await typeInto($<HTMLInputElement>("scout-aff-1a-first"), "Ada");
        await typeInto($<HTMLInputElement>("scout-aff-1a-last"), "Lovelace");
        await typeInto($<HTMLInputElement>("scout-aff-2a-first"), "Alan");
        await typeInto($<HTMLInputElement>("scout-neg-1n-last"), "Hopper");
        await typeInto($<HTMLInputElement>("scout-neg-2n-first"), "Grace");
        await typeInto($<HTMLInputElement>("scout-tournament"), "TOC");
        await typeInto($<HTMLInputElement>("scout-round"), "Finals");
        await typeInto($<HTMLInputElement>("scout-flight"), "B");
        await typeInto($<HTMLInputElement>("scout-judge"), "J. Doe");
        await typeInto($<HTMLInputElement>("scout-date"), "2030-04-01");

        expect(scouting()).toMatchObject({
            affSchool: "Westside",
            negSchool: "Eastside",
            tournament: "TOC",
            round: "Finals",
            flight: "B",
            judge: "J. Doe",
            date: "2030-04-01",
            aff: { first: { first: "Ada", last: "Lovelace" }, second: { first: "Alan" } },
            neg: { first: { last: "Hopper" }, second: { first: "Grace" } },
        });
        expect($("info-panel").textContent).toContain("Westside");

        await typeInto($<HTMLInputElement>("scout-date"), "");
        expect(scouting().date).toBeUndefined();
    });

    it("toggles the vote and clears it on a second click", async () => {
        await click($("scout-vote-neg"));
        expect(scouting().decision?.vote).toBe("neg");
        expect($("scout-vote-neg").getAttribute("aria-pressed")).toBe("true");
        await click($("scout-vote-neg"));
        expect(scouting().decision?.vote).toBeUndefined();
    });

    it("autofills an empty sheet from a pasted pairing and ignores unreadable text", async () => {
        await paste("nothing useful");
        expect(scouting().round).toBeFalsy();
        await paste(PAIRING);
        expect(scouting().round).toBe("Round 3");
    });

    it("asks before a pairing overwrites existing details", async () => {
        await typeInto($<HTMLInputElement>("scout-judge"), "Someone");
        await paste(PAIRING);
        expect(scouting().round).toBeFalsy();
        expect($("info-panel").textContent).toContain("Replace the current round info");

        await click($("scout-paste-cancel"));
        expect(document.querySelector("[data-testid=scout-paste-confirm]")).toBeNull();

        await paste(PAIRING);
        await click($("scout-paste-confirm"));
        expect(scouting()).toMatchObject({ round: "Round 3", judge: "Someone" });
    });

    it("closes through its close button", async () => {
        await click($("info-close"));
        expect(useFlowStore.getState().infoOpen).toBe(false);
    });
});
