import { describe, expect, it } from "vitest";
import { withRouteErrors } from "../route-errors";

describe("withRouteErrors", () => {
  it("answers 503 with Retry-After when D1 is overloaded", async () => {
    const handler = withRouteErrors("GET /test", async () => {
      throw new Error("Failed query: select 1", {
        cause: new Error("D1_ERROR: D1 DB is overloaded. Too many resources consumed within a 10 second window"),
      });
    });
    const res = await handler();
    expect(res.status).toBe(503);
    expect(res.headers.get("retry-after")).toBe("5");
    expect(await res.json()).toMatchObject({ busy: true });
  });

  it("answers 503, not 401, when the session lookup failed", async () => {
    const handler = withRouteErrors("GET /test", async () => {
      const error = new Error("Could not look up the session; try again shortly.");
      error.name = "SessionUnavailableError";
      throw error;
    });
    expect((await handler()).status).toBe(503);
  });

  it("keeps other failures opaque 500s", async () => {
    const handler = withRouteErrors("GET /test", async () => {
      throw new Error("boom");
    });
    expect((await handler()).status).toBe(500);
  });
});
