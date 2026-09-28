import { describe, expect, it } from "vitest";
import { TournSchema, parseTabroom, tabroomSchemas } from "../src/index";

const tourn = {
  id: "42",
  name: "Greenhill Fall Classic",
  city: "Dallas",
  state: "TX",
  country: "US",
  tz: "America/Chicago",
  webname: "greenhill",
  hidden: false,
  start: "2026-09-18T13:00:00Z",
  end: "2026-09-20T23:00:00Z",
  regStart: "2026-08-01T00:00:00Z",
  regEnd: "2026-09-10T00:00:00Z",
};

describe("debate-tournaments-tabroom-adapter", () => {
  it("validates a tournament with upstream Tabroom's own schema", () => {
    const result = parseTabroom(TournSchema, tourn);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe(42);
      expect(result.data.start).toBeInstanceOf(Date);
    }
  });

  it("reports issues instead of throwing", () => {
    const result = parseTabroom(TournSchema, { ...tourn, hidden: "no" });
    expect(result).toMatchObject({ ok: false, issues: [{ path: "hidden" }] });
  });

  it("keys every upstream schema by record name", () => {
    expect(tabroomSchemas.Tourn).toBe(TournSchema);
    expect(Object.keys(tabroomSchemas).length).toBeGreaterThan(20);
  });
});
