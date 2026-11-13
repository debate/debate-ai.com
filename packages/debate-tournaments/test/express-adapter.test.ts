/**
 * The fetch ⇄ Express bridge the vendored routers run on, driven by tiny
 * hand-written routers so every request and response helper is pinned down.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { runExpressRouter, type ExpressLikeRouter } from "../src/api/express-adapter";

const run = (router: ExpressLikeRouter, init: RequestInit & { url?: string } = {}, locals?: Record<string, unknown>) =>
  runExpressRouter(router, new Request(init.url ?? "https://debate-ai.test/api/rest/tourns?x=1&tag=a&tag=b", init), {
    path: "/rest/tourns",
    locals,
  });

afterEach(() => vi.restoreAllMocks());

describe("the request it hands the router", () => {
  it("carries the method, routed url, query, headers, cookies, ip and locals", async () => {
    let seen: any;
    const response = await run(
      (req, res) => {
        seen = req;
        res.json({ ok: true });
      },
      {
        headers: { cookie: "a=1; b=hello%20world; broken", "X-Forwarded-For": "10.0.0.1, 10.0.0.2", "X-Test": "yes" },
      },
      { actor: { type: "anonymous" } },
    );
    expect(response.status).toBe(200);
    expect(seen.method).toBe("GET");
    expect(seen.url).toBe("/rest/tourns?x=1&tag=a&tag=b");
    expect(seen.path).toBe("/rest/tourns");
    expect(seen.query).toEqual({ x: "1", tag: ["a", "b"] });
    expect(seen.cookies).toEqual({ a: "1", b: "hello world" });
    expect(seen.ip).toBe("10.0.0.1");
    expect(seen.get("x-test")).toBe("yes");
    expect(seen.header("X-TEST")).toBe("yes");
    expect(seen.protocol).toBe("https");
    expect(seen.hostname).toBe("debate-ai.test");
    expect(seen.actor).toEqual({ type: "anonymous" });
    expect(seen.body).toBeUndefined();
    expect(seen.res.req).toBe(seen);
  });

  it("prefers cf-connecting-ip and reads no ip when there is none", async () => {
    const ips: string[] = [];
    const router: ExpressLikeRouter = (req, res) => {
      ips.push(req.ip);
      res.end();
    };
    await run(router, { headers: { "cf-connecting-ip": "1.2.3.4", "x-forwarded-for": "5.6.7.8" } });
    await run(router);
    expect(ips).toEqual(["1.2.3.4", ""]);
  });

  it.each([
    ["application/json", '{"a":1}', { a: 1 }],
    ["application/json", "{not json", "{not json"],
    ["application/x-www-form-urlencoded", "a=1&b=two", { a: "1", b: "two" }],
    ["text/plain", "plain", "plain"],
  ])("parses a %s body", async (type, text, expected) => {
    let body: unknown;
    await run(
      (req, res) => {
        body = req.body;
        res.end();
      },
      { method: "POST", headers: { "content-type": type }, body: text },
    );
    expect(body).toEqual(expected);
  });

  it("leaves an empty body undefined", async () => {
    let body: unknown = "unset";
    await run(
      (req, res) => {
        body = req.body;
        res.end();
      },
      { method: "POST", body: "" },
    );
    expect(body).toBeUndefined();
  });
});

describe("the response it builds", () => {
  it("sets status, headers and a JSON body", async () => {
    const response = await run((_req, res) => {
      res.status(201).set({ "x-a": "1" }).set("x-b", "2").header("x-c", "3").setHeader("x-d", "4");
      expect(res.get("x-a")).toBe("1");
      expect(res.getHeader("x-d")).toBe("4");
      expect(res.get("x-missing")).toBeUndefined();
      res.set("x-ignored");
      res.json({ hello: "world" });
    });
    expect(response.status).toBe(201);
    expect(["x-a", "x-b", "x-c", "x-d"].map((h) => response.headers.get(h))).toEqual(["1", "2", "3", "4"]);
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(await response.json()).toEqual({ hello: "world" });
  });

  it("keeps a content type the route set, and serializes undefined JSON as null", async () => {
    const response = await run((_req, res) => res.type("text/csv").json(undefined));
    expect(response.headers.get("content-type")).toBe("text/csv");
    expect(await response.text()).toBe("null");
  });

  it("expands a short type", async () => {
    const response = await run((_req, res) => res.type("json").send("{}"));
    expect(response.headers.get("content-type")).toBe("application/json");
  });

  it("sends strings as HTML, objects as JSON and numbers as a status", async () => {
    const html = await run((_req, res) => res.send("<p>hi</p>"));
    expect(html.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(await html.text()).toBe("<p>hi</p>");

    const json = await run((_req, res) => res.send({ a: 1 }));
    expect(await json.json()).toEqual({ a: 1 });

    const status = await run((_req, res) => res.send(418));
    expect(status.status).toBe(418);

    const bytes = await run((_req, res) => res.send(new Uint8Array([104, 105])));
    expect(await bytes.text()).toBe("hi");
  });

  it("answers sendStatus with the code as text", async () => {
    const response = await run((_req, res) => res.sendStatus(202));
    expect(response.status).toBe(202);
    expect(await response.text()).toBe("202");
  });

  it("redirects with and without an explicit status", async () => {
    const found = await run((_req, res) => res.redirect("/elsewhere"));
    expect([found.status, found.headers.get("location")]).toEqual([302, "/elsewhere"]);
    const moved = await run((_req, res) => res.redirect(301, "/moved"));
    expect([moved.status, moved.headers.get("location")]).toEqual([301, "/moved"]);
  });

  it("drops the body for 204 and HEAD", async () => {
    const empty = await run((_req, res) => res.status(204).send("ignored"));
    expect(await empty.text()).toBe("");
    const head = await run((_req, res) => res.send("ignored"), { method: "HEAD" });
    expect(await head.text()).toBe("");
  });

  it("fires finish listeners and resolves only once", async () => {
    const finished = vi.fn();
    const response = await run((_req, res) => {
      res.on("finish", finished);
      res.once("finish", finished);
      res.status(200).end("first");
      res.status(500).end("second");
    });
    expect(await response.text()).toBe("first");
    expect(finished).toHaveBeenCalledTimes(4);
  });
});

describe("when no route answers", () => {
  it("is a 404 problem", async () => {
    const response = await run((_req, _res, done) => done());
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toBe("application/problem+json");
    expect(await response.json()).toMatchObject({ title: "Not Found", detail: "No route for GET /rest/tourns" });
  });

  it("is a 500 problem when the route fails or throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const failed = await run((_req, _res, done) => done(new Error("boom")));
    expect(failed.status).toBe(500);
    const thrown = await run(() => {
      throw new Error("thrown");
    });
    expect(thrown.status).toBe(500);
    expect(await thrown.json()).toMatchObject({ title: "Internal Server Error" });
  });
});
