/**
 * @fileoverview Keeping one peer in step.
 *
 * The two rules that make this sound are worth stating in tests rather than
 * only in comments: a typing burst coalesces into one delta rather than a
 * message per keystroke, and `sent` is never raised from what *arrives* —
 * crediting an echo of our own cell would suppress every earlier cell of ours
 * the sender never received, and a high-water vector cannot describe that hole.
 */

import { describe, expect, it, vi } from "vitest";
import { seedDoc } from "../src/lib/collab/doc";
import { deltaSince, emptyVector, vectorOf } from "../src/lib/collab/delta";
import { merge } from "../src/lib/collab/merge";
import { seedRank } from "../src/lib/collab/rank";
import { attachSync, defaultSchedule, type PeerSync } from "../src/lib/collab/sync";
import { type Stamp } from "../src/lib/collab/stamp";
import { cellKey, type CollabDoc } from "../src/lib/collab/types";
import { emptyScouting, type FlowRound, type FlowSheet } from "../src/lib/model/flow";
import type { PeerConn, WireMessage } from "../src/lib/collab/peerLink";

const at = (ms: number, actor: string): Stamp => ({ ms, counter: 0, actor });

const sheet = (over: Partial<FlowSheet> = {}): FlowSheet => ({
    id: "s1",
    title: "1.",
    group: "aff",
    order: 0,
    kind: "flow",
    data: [["a"]],
    meta: {},
    ...over,
});

const round = (): FlowRound =>
    ({
        id: "r1",
        createdAt: 0,
        updatedAt: 0,
        event: "policy",
        firstSide: "aff",
        scouting: emptyScouting(),
        sheets: [sheet()],
    }) as FlowRound;

const KEY0 = cellKey(0, seedRank(0), "");

/** A connection that records what was sent and can feed messages back in. */
function fakeConn() {
    const sent: WireMessage[] = [];
    let handler: ((msg: WireMessage) => void) | null = null;
    const conn: PeerConn = {
        send: (msg: WireMessage) => sent.push(msg),
        onMessage: (fn: (msg: WireMessage) => void) => {
            handler = fn;
        },
    } as unknown as PeerConn;
    return {
        conn,
        sent,
        deliver: (msg: WireMessage) => handler?.(msg),
    };
}

/** A schedule that fires only when the test says so. */
function fakeClock() {
    const pending: { fn: () => void; ms: number }[] = [];
    const schedule = (fn: () => void, ms: number) => {
        const entry = { fn, ms };
        pending.push(entry);
        return () => {
            const i = pending.indexOf(entry);
            if (i >= 0) pending.splice(i, 1);
        };
    };
    return {
        schedule,
        pending,
        /** Fire every timer armed at `ms`, once. */
        fire(ms: number) {
            const due = pending.filter((p) => p.ms === ms);
            for (const entry of due) {
                const i = pending.indexOf(entry);
                if (i >= 0) pending.splice(i, 1);
                entry.fn();
            }
        },
    };
}

function setup(over: Partial<Parameters<typeof attachSync>[0]> = {}) {
    const link = fakeConn();
    const clock = fakeClock();
    let doc = seedDoc(round());
    const applied: CollabDoc[] = [];
    const sync: PeerSync = attachSync({
        conn: link.conn,
        doc: () => doc,
        apply: (incoming) => {
            applied.push(incoming);
            doc = merge(doc, incoming).doc;
            return [];
        },
        endpointId: "me",
        from: "them",
        schedule: clock.schedule,
        ...over,
    });
    return {
        sync,
        link,
        clock,
        applied,
        get doc() {
            return doc;
        },
        edit(text: string, stamp: Stamp) {
            doc = {
                ...doc,
                sheets: {
                    ...doc.sheets,
                    s1: {
                        ...doc.sheets.s1,
                        cells: {
                            ...doc.sheets.s1.cells,
                            [KEY0]: { ...doc.sheets.s1.cells[KEY0], text, textStamp: stamp },
                        },
                    },
                },
            };
        },
    };
}

/** The coalesce and repair widths the module arms its timers at. */
const COALESCE_MS = 30;
const REPAIR_MS = 5_000;

describe("defaultSchedule", () => {
    it("fires after the delay and hands back a way to cancel", async () => {
        vi.useFakeTimers();
        const fn = vi.fn();
        defaultSchedule(fn, 10);
        vi.advanceTimersByTime(10);
        expect(fn).toHaveBeenCalledTimes(1);

        const cancelled = vi.fn();
        defaultSchedule(cancelled, 10)();
        vi.advanceTimersByTime(20);
        expect(cancelled).not.toHaveBeenCalled();
        vi.useRealTimers();
    });
});

describe("pushing local changes", () => {
    it("sends nothing until the coalesce window closes", () => {
        const s = setup();
        s.edit("typed", at(5, "me"));
        s.sync.notifyLocalChange();
        expect(s.link.sent).toHaveLength(0);
    });

    it("sends one delta for a burst of changes", () => {
        const s = setup();
        s.edit("t", at(5, "me"));
        s.sync.notifyLocalChange();
        s.sync.notifyLocalChange();
        s.sync.notifyLocalChange();
        s.clock.fire(COALESCE_MS);
        expect(s.link.sent.filter((m) => m.type === "delta")).toHaveLength(1);
    });

    it("sends the change the burst ended on, read at send time", () => {
        const s = setup();
        s.sync.notifyLocalChange();
        s.edit("final", at(9, "me"));
        s.clock.fire(COALESCE_MS);
        const [delta] = s.link.sent.filter((m) => m.type === "delta");
        expect((delta as { doc: CollabDoc }).doc.sheets.s1.cells[KEY0].text).toBe("final");
    });

    it("sends nothing when there is nothing new to send", () => {
        const s = setup();
        s.sync.notifyLocalChange();
        s.clock.fire(COALESCE_MS);
        expect(s.link.sent.filter((m) => m.type === "delta")).toHaveLength(0);
    });

    it("does not resend a change the far side already has", () => {
        const s = setup();
        s.edit("one", at(5, "me"));
        s.sync.notifyLocalChange();
        s.clock.fire(COALESCE_MS);
        s.sync.notifyLocalChange();
        s.clock.fire(COALESCE_MS);
        expect(s.link.sent.filter((m) => m.type === "delta")).toHaveLength(1);
    });

    it("sends the next change after the first was acknowledged by shipping", () => {
        const s = setup();
        s.edit("one", at(5, "me"));
        s.sync.notifyLocalChange();
        s.clock.fire(COALESCE_MS);
        s.edit("two", at(6, "me"));
        s.sync.notifyLocalChange();
        s.clock.fire(COALESCE_MS);
        expect(s.link.sent.filter((m) => m.type === "delta")).toHaveLength(2);
    });
});

describe("sendState", () => {
    it("sends the whole document, for a peer with no file of its own", () => {
        const s = setup();
        s.sync.sendState();
        const [state] = s.link.sent.filter((m) => m.type === "state");
        expect(state).toBeDefined();
        expect(Object.keys((state as { doc: CollabDoc }).doc.sheets)).toEqual(["s1"]);
    });

    it("credits what it sent, so the next push carries only what followed", () => {
        const s = setup();
        s.sync.sendState();
        s.sync.notifyLocalChange();
        s.clock.fire(COALESCE_MS);
        expect(s.link.sent.filter((m) => m.type === "delta")).toHaveLength(0);
    });
});

describe("receiving", () => {
    it("applies an incoming delta", () => {
        const s = setup();
        const theirs = seedDoc(round());
        theirs.round.event = { value: "pf", stamp: at(9, "them") };
        s.link.deliver({ type: "delta", doc: deltaSince(theirs, emptyVector()) });
        expect(s.applied).toHaveLength(1);
        expect(s.doc.round.event.value).toBe("pf");
    });

    it("applies an incoming state and replies with what the sender is missing", () => {
        const s = setup();
        s.edit("only here", at(9, "me"));
        s.link.deliver({ type: "state", doc: seedDoc(round()) });
        expect(s.applied).toHaveLength(1);
        const [delta] = s.link.sent.filter((m) => m.type === "delta");
        expect((delta as { doc: CollabDoc }).doc.sheets.s1.cells[KEY0].text).toBe("only here");
    });

    it("answers a repair vector with everything above it", () => {
        const s = setup();
        s.edit("only here", at(9, "me"));
        s.link.deliver({ type: "vector", seen: emptyVector() });
        const [delta] = s.link.sent.filter((m) => m.type === "delta");
        expect((delta as { doc: CollabDoc }).doc.sheets.s1.cells[KEY0].text).toBe("only here");
    });

    it("answers a vector that is already current with nothing", () => {
        const s = setup();
        s.link.deliver({ type: "vector", seen: vectorOf(s.doc) });
        expect(s.link.sent.filter((m) => m.type === "delta")).toHaveLength(0);
    });

    it("ignores a message type this build does not know", () => {
        const s = setup();
        expect(() => s.link.deliver({ type: "hello" } as never)).not.toThrow();
        expect(s.applied).toHaveLength(0);
    });

    it("does not credit an echo of our own write, which would suppress a real hole", () => {
        const s = setup();
        s.edit("mine", at(9, "me"));
        // The far side hands our own cell straight back inside a delta.
        s.link.deliver({ type: "delta", doc: deltaSince(s.doc, emptyVector()) });
        // The push still ships it: `sent` was not raised by what arrived.
        s.sync.notifyLocalChange();
        s.clock.fire(COALESCE_MS);
        expect(s.link.sent.filter((m) => m.type === "delta")).toHaveLength(1);
    });
});

describe("a read-only peer", () => {
    it("refuses an inbound delta", () => {
        const s = setup({ readOnly: true });
        s.link.deliver({ type: "delta", doc: seedDoc(round()) });
        expect(s.applied).toHaveLength(0);
    });

    it("refuses an inbound state, and does not reply to it", () => {
        const s = setup({ readOnly: true });
        s.link.deliver({ type: "state", doc: seedDoc(round()) });
        expect(s.applied).toHaveLength(0);
        expect(s.link.sent.filter((m) => m.type === "delta")).toHaveLength(0);
    });

    it("still answers a repair vector, since that reads rather than writes", () => {
        const s = setup({ readOnly: true });
        s.edit("only here", at(9, "me"));
        s.link.deliver({ type: "vector", seen: emptyVector() });
        expect(s.link.sent.filter((m) => m.type === "delta")).toHaveLength(1);
    });
});

describe("the repair tick", () => {
    it("arms itself on attach", () => {
        const s = setup();
        expect(s.clock.pending.some((p) => p.ms === REPAIR_MS)).toBe(true);
    });

    it("states the highest stamp seen per actor", () => {
        const s = setup();
        s.edit("mine", at(9, "me"));
        s.clock.fire(REPAIR_MS);
        const [vector] = s.link.sent.filter((m) => m.type === "vector");
        expect((vector as { seen: Record<string, Stamp> }).seen.me).toEqual(at(9, "me"));
    });

    it("re-arms itself, so repair keeps running", () => {
        const s = setup();
        s.clock.fire(REPAIR_MS);
        expect(s.clock.pending.some((p) => p.ms === REPAIR_MS)).toBe(true);
    });
});

describe("stop", () => {
    it("sends nothing more once stopped", () => {
        const s = setup();
        s.edit("mine", at(9, "me"));
        s.sync.notifyLocalChange();
        s.sync.stop();
        s.clock.fire(COALESCE_MS);
        s.sync.sendState();
        expect(s.link.sent).toHaveLength(0);
    });

    it("cancels the repair tick", () => {
        const s = setup();
        s.sync.stop();
        expect(s.clock.pending).toHaveLength(0);
    });

    it("applies nothing more once stopped", () => {
        const s = setup();
        s.sync.stop();
        s.link.deliver({ type: "delta", doc: seedDoc(round()) });
        expect(s.applied).toHaveLength(0);
    });

    it("is safe to call twice", () => {
        const s = setup();
        s.sync.stop();
        expect(() => s.sync.stop()).not.toThrow();
    });
});
