// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const rt = vi.hoisted(() => ({
    inviteContact: vi.fn(async () => {}),
    joinByCode: vi.fn(),
    resumeJoined: vi.fn(async () => {}),
    startPairing: vi.fn(),
    currentSession: vi.fn(() => null as object | null),
    endSession: vi.fn(async () => {}),
    desktop: { value: true },
}));

vi.mock("../src/lib/collab/runtime", () => rt);
vi.mock("../src/lib/update/adapter", () => ({ isDesktop: () => rt.desktop.value }));

import { runEnd, runInvite, runJoin, runShare, type CollabCommandDeps } from "../src/lib/commands/collabCommands";
import { makeFlowRound } from "../src/lib/model/flow";
import { useFlowStore } from "../src/lib/store/useFlowStore";

const PEER = "b".repeat(64);
const initial = useFlowStore.getState();

function deps(over: Partial<CollabCommandDeps> = {}) {
    return {
        chooseContact: vi.fn(async () => PEER as string | null),
        notify: vi.fn(),
        fail: vi.fn(),
        consent: vi.fn(async () => true),
        openShare: vi.fn(),
        showCode: vi.fn(),
        failShare: vi.fn(),
        askForCode: vi.fn(async () => "CODE" as string | null),
        openFlow: vi.fn(),
        ...over,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    rt.desktop.value = true;
    useFlowStore.setState(initial, true);
    useFlowStore.setState({ collabEnabled: true, collabRelayEnabled: true });
});

describe("runShare", () => {
    it("stops without consent or without a round", async () => {
        const d = deps({ consent: vi.fn(async () => false) });
        await runShare(d);
        expect(d.openShare).not.toHaveBeenCalled();
        const d2 = deps();
        await runShare(d2);
        expect(d2.fail).toHaveBeenCalledWith("Open a flow to share it");
    });

    it("shows the code, warning when relaying is off", async () => {
        useFlowStore.getState().loadRound(makeFlowRound());
        const stop = vi.fn();
        rt.startPairing.mockResolvedValueOnce({ code: "ABCD", stop });
        const d = deps();
        await runShare(d, "viewer");
        expect(d.openShare).toHaveBeenCalledWith("viewer", "");
        expect(d.showCode).toHaveBeenCalledWith("ABCD", stop);

        useFlowStore.setState({ collabRelayEnabled: false });
        rt.startPairing.mockResolvedValueOnce(null);
        const d2 = deps();
        await runShare(d2);
        expect(d2.openShare).toHaveBeenCalledWith("editor", expect.stringMatching(/same wifi/));
        expect(d2.failShare).toHaveBeenCalledWith("Could not start a session");

        rt.startPairing.mockRejectedValueOnce(new Error("relay down"));
        const d3 = deps();
        await runShare(d3);
        expect(d3.failShare).toHaveBeenCalledWith("relay down");
        rt.startPairing.mockRejectedValueOnce("odd");
        const d4 = deps();
        await runShare(d4);
        expect(d4.failShare).toHaveBeenCalledWith("Could not share this round");
    });
});

describe("runJoin", () => {
    it("joins and opens the flow", async () => {
        rt.joinByCode.mockResolvedValueOnce({ path: "/j.ebb", created: true });
        const d = deps();
        await runJoin(d);
        expect(rt.joinByCode).toHaveBeenCalledWith("CODE");
        expect(rt.resumeJoined).toHaveBeenCalledWith("/j.ebb");
        expect(d.notify).toHaveBeenCalledWith("Joined. The round is yours to keep.");
        expect(d.openFlow).toHaveBeenCalledWith("/j.ebb");

        rt.joinByCode.mockResolvedValueOnce({ path: "/j.ebb", created: false });
        const d2 = deps();
        await runJoin(d2);
        expect(d2.notify).toHaveBeenCalledWith("Joined.");
    });

    it("backs out on no consent or no code, and explains a null join", async () => {
        const d = deps({ consent: vi.fn(async () => false) });
        await runJoin(d);
        expect(d.askForCode).not.toHaveBeenCalled();
        const d2 = deps({ askForCode: vi.fn(async () => null) });
        await runJoin(d2);
        expect(rt.joinByCode).not.toHaveBeenCalled();

        rt.joinByCode.mockResolvedValueOnce(null);
        const d3 = deps();
        await runJoin(d3);
        expect(d3.fail).not.toHaveBeenCalled();
        rt.desktop.value = false;
        rt.joinByCode.mockResolvedValueOnce(null);
        const d4 = deps();
        await runJoin(d4);
        expect(d4.fail).toHaveBeenCalledWith("Turn on shared editing in Settings first");

        rt.joinByCode.mockRejectedValueOnce(new Error("bad code"));
        const d5 = deps();
        await runJoin(d5);
        expect(d5.fail).toHaveBeenCalledWith("bad code");
        rt.joinByCode.mockRejectedValueOnce(42);
        const d6 = deps();
        await runJoin(d6);
        expect(d6.fail).toHaveBeenCalledWith("Could not join that round");
    });
});

describe("runEnd", () => {
    it("reports no session, ends one, and surfaces failure", async () => {
        const d = deps();
        await runEnd(d);
        expect(d.fail).toHaveBeenCalledWith("No session is running");
        rt.currentSession.mockReturnValue({});
        const d2 = deps();
        await runEnd(d2);
        expect(d2.notify).toHaveBeenCalledWith("Session ended. The flow is still yours.");
        rt.endSession.mockRejectedValueOnce(new Error("stuck"));
        const d3 = deps();
        await runEnd(d3);
        expect(d3.fail).toHaveBeenCalledWith("stuck");
        rt.endSession.mockRejectedValueOnce(null);
        const d4 = deps();
        await runEnd(d4);
        expect(d4.fail).toHaveBeenCalledWith("Could not end the session cleanly");
    });
});

describe("runInvite", () => {
    it("checks consent, round and contacts", async () => {
        const d0 = deps({ consent: vi.fn(async () => false) });
        await runInvite(d0);
        expect(d0.fail).not.toHaveBeenCalled();
        const d = deps();
        await runInvite(d);
        expect(d.fail).toHaveBeenCalledWith("Open a flow to share it");
        useFlowStore.getState().loadRound(makeFlowRound());
        const d2 = deps();
        await runInvite(d2);
        expect(d2.fail).toHaveBeenCalledWith(expect.stringMatching(/No saved partners/));
    });

    it("invites the chosen contact with the role", async () => {
        const round = makeFlowRound();
        useFlowStore.getState().loadRound(round);
        useFlowStore.setState({ contacts: { [PEER]: { name: "Sam" } } as never });
        const d = deps();
        await runInvite(d, "viewer");
        expect(d.chooseContact).toHaveBeenCalledWith({ [PEER]: { name: "Sam" } }, "viewer");
        expect(rt.inviteContact).toHaveBeenCalledWith(round, PEER, "viewer");
        expect(d.notify).toHaveBeenCalledWith("Invited Sam to view");
        const d2 = deps();
        await runInvite(d2);
        expect(d2.notify).toHaveBeenCalledWith("Invited Sam to edit");

        const d3 = deps({ chooseContact: vi.fn(async () => null) });
        await runInvite(d3);
        expect(rt.inviteContact).toHaveBeenCalledTimes(2);

        rt.inviteContact.mockRejectedValueOnce(new Error("unreachable"));
        const d4 = deps();
        await runInvite(d4);
        expect(d4.fail).toHaveBeenCalledWith("unreachable");
        rt.inviteContact.mockRejectedValueOnce("x");
        const d5 = deps();
        await runInvite(d5);
        expect(d5.fail).toHaveBeenCalledWith("Could not reach that partner");
    });
});
