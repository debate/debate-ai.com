import { describe, expect, it } from "vitest";
import { describeDeletionScope, waitingFor } from "../../../src/components/admin/users/DeletionRequestsPanel";

describe("DeletionRequestsPanel helpers", () => {
  it("describes what a request covers", () => {
    expect(describeDeletionScope({ scope: "all", categories: ["flows"] })).toBe("Everything");
    expect(describeDeletionScope({ scope: "part", categories: ["documents", "speech-audio"] })).toBe(
      "Documents, cards and research, Saved speech audio",
    );
    expect(describeDeletionScope({ scope: "part", categories: ["retired-kind"] })).toBe("retired-kind");
    expect(describeDeletionScope({ scope: "part", categories: [] })).toBe("Described in notes");
  });

  it("says how long a request has waited", () => {
    const now = new Date("2026-11-21T12:00:00Z").getTime();
    expect(waitingFor("2026-11-21T01:00:00Z", now)).toBe("today");
    expect(waitingFor("2026-11-20T11:00:00Z", now)).toBe("1 day");
    expect(waitingFor("2026-11-01T12:00:00Z", now)).toBe("20 days");
    expect(waitingFor("2026-11-22T00:00:00Z", now)).toBe("today");
  });
});
