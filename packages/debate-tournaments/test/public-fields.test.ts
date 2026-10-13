import { describe, expect, it } from "vitest";
import { publicRow, stripPrivateFields, withoutPrivateFields } from "../src/api/public-fields";

describe("public fields", () => {
  it("strips credentials and contact details at any depth", () => {
    const person = { id: 1, first: "A", password: "$2b$hash", pass_timestamp: "x", phone: "+1 555", tz: "UTC" };
    expect(stripPrivateFields({ people: [person], room: { name: "101", judge_password: "pw" } })).toEqual({
      people: [{ id: 1, first: "A", tz: "UTC" }],
      room: { name: "101" },
    });
  });

  it("applies a table's allowlist, keeping keys another table publishes", () => {
    expect(publicRow("person", { id: 1, street: "1 Main", city: "X", password: "h" })).toEqual({ id: 1, city: "X" });
    expect(publicRow("chapter", { id: 1, street: "1 Main" })).toEqual({ id: 1, street: "1 Main" });
  });

  it("rewrites JSON responses and passes others through", async () => {
    const json = new Response(JSON.stringify({ password: "h", ok: 1 }), { headers: { "content-type": "application/json" } });
    expect(await (await withoutPrivateFields(json)).json()).toEqual({ ok: 1 });
    const html = new Response("<p>password</p>", { headers: { "content-type": "text/html" } });
    expect(await (await withoutPrivateFields(html)).text()).toBe("<p>password</p>");
  });
});
