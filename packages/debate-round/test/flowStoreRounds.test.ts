import { beforeEach, describe, expect, it } from "vitest";
import { useFlowStore } from "../src/state/store";
import type { Round } from "../src/types/flow";

function makeRoundInput(overrides: Partial<Omit<Round, "id" | "timestamp">> = {}): Omit<Round, "id" | "timestamp"> {
  return {
    tournamentName: "Glenbrooks",
    roundLevel: "Octafinals",
    debaters: { aff: ["a@b.com", ""], neg: ["c@d.com", ""] },
    judges: ["judge@e.com"],
    flowIds: [],
    status: "completed",
    ...overrides,
  };
}

describe("useFlowStore round CRUD", () => {
  beforeEach(() => {
    useFlowStore.setState({ rounds: [] });
  });

  it("createRound appends a round with a generated id/timestamp and keeps prior rounds", () => {
    const first = useFlowStore.getState().createRound(makeRoundInput({ tournamentName: "Berkeley" }));
    const second = useFlowStore.getState().createRound(makeRoundInput({ tournamentName: "Glenbrooks" }));

    expect(useFlowStore.getState().rounds).toEqual([first, second]);
    expect(first.tournamentName).toBe("Berkeley");
    expect(typeof first.id).toBe("number");
    expect(typeof first.timestamp).toBe("number");
  });

  it("createRound never assigns the same id twice, even when called back-to-back", () => {
    // Regression test: id used to be a bare Date.now(), so rounds created
    // within the same millisecond collided — updateRound/deleteRound would
    // then silently affect every round sharing that id.
    const rounds = Array.from({ length: 25 }, (_, i) =>
      useFlowStore.getState().createRound(makeRoundInput({ tournamentName: `Round ${i}` })),
    );

    const ids = rounds.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("updateRound merges a partial patch into the matching round only", () => {
    const round = useFlowStore.getState().createRound(makeRoundInput({ tournamentName: "Berkeley" }));
    const other = useFlowStore.getState().createRound(makeRoundInput({ tournamentName: "Glenbrooks" }));

    useFlowStore.getState().updateRound(round.id, { status: "active", winner: "aff" });

    const rounds = useFlowStore.getState().rounds;
    expect(rounds.find((r) => r.id === round.id)).toMatchObject({ status: "active", winner: "aff" });
    expect(rounds.find((r) => r.id === other.id)).toMatchObject({ status: "completed" });
    expect(rounds.find((r) => r.id === other.id)?.winner).toBeUndefined();
  });

  it("updateRound is a no-op when no round matches the given id", () => {
    const round = useFlowStore.getState().createRound(makeRoundInput());
    useFlowStore.getState().updateRound(round.id + 1, { status: "active" });

    expect(useFlowStore.getState().rounds).toEqual([round]);
  });

  it("deleteRound removes only the matching round", () => {
    const first = useFlowStore.getState().createRound(makeRoundInput({ tournamentName: "Berkeley" }));
    const second = useFlowStore.getState().createRound(makeRoundInput({ tournamentName: "Glenbrooks" }));

    useFlowStore.getState().deleteRound(first.id);

    expect(useFlowStore.getState().rounds).toEqual([second]);
  });

  it("deleteRound is a no-op when no round matches the given id", () => {
    const round = useFlowStore.getState().createRound(makeRoundInput());
    useFlowStore.getState().deleteRound(round.id + 1);

    expect(useFlowStore.getState().rounds).toEqual([round]);
  });

  it("deleteRound never touches flows — only the store's rounds list", () => {
    useFlowStore.setState({
      flows: [
        {
          content: "1AC",
          level: 0,
          columns: ["1AC", "1NC"],
          invert: false,
          focus: false,
          index: 0,
          lastFocus: [0],
          children: [],
          id: 1,
        },
      ],
    });
    const round = useFlowStore.getState().createRound(makeRoundInput({ flowIds: [1] }));

    useFlowStore.getState().deleteRound(round.id);

    expect(useFlowStore.getState().rounds).toEqual([]);
    expect(useFlowStore.getState().flows).toHaveLength(1);
  });
});
