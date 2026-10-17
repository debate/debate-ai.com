import { describe, expect, it } from "vitest";
import {
  D1_BOOKMARK_COOKIE,
  D1_BOOKMARK_HEADER,
  applyD1Bookmark,
  getD1Bookmark,
  getD1ReplicaInfo,
  runWithD1Session,
  runWithPrimaryD1Session,
  sessionedD1,
} from "../d1-session";

interface FakeResult {
  results: unknown[];
  success: boolean;
  meta: Record<string, unknown>;
}

interface FakeStatement {
  bind(...values: unknown[]): FakeStatement;
  first(colName?: string): Promise<unknown>;
  run(): Promise<FakeResult>;
  all(): Promise<FakeResult>;
  raw(options?: unknown): Promise<unknown[]>;
}

/**
 * A stand-in for the D1 binding that records how it was used: the constraint
 * each session was opened with, and which statements ran where. Calls landing
 * on `binding` rather than on a session are the un-sessioned path.
 */
function fakeD1() {
  const opened: string[] = [];
  const ranOnBinding: string[] = [];
  const ranInSession: string[] = [];
  let bookmark: string | null = null;
  // Constraints the fake refuses to serve, and the error it raises when a
  // statement runs on such a session — D1 only rejects a bookmark it cannot
  // honour once a query actually runs, since `withSession()` does no I/O.
  const rejected = new Map<string, string>();

  const statement = (
    sql: string,
    sink: string[],
    meta: Record<string, unknown>,
    constraint?: string,
  ): FakeStatement => {
    const check = () => {
      const message = constraint === undefined ? undefined : rejected.get(constraint);
      if (message) throw new Error(message);
    };
    const self: FakeStatement = {
      bind: (...values: unknown[]) => {
        sink.push(`bind:${sql}:${values.join(",")}`);
        return self;
      },
      run: async () => {
        sink.push(`run:${sql}`);
        check();
        return { results: [], success: true, meta };
      },
      all: async () => {
        sink.push(`all:${sql}`);
        check();
        return { results: [], success: true, meta };
      },
      first: async () => {
        sink.push(`first:${sql}`);
        check();
        return null;
      },
      raw: async () => {
        sink.push(`raw:${sql}`);
        check();
        return [];
      },
    };
    return self;
  };

  const binding = {
    prepare: (sql: string) => statement(sql, ranOnBinding, { served_by_primary: true }),
    batch: async (statements: FakeStatement[]): Promise<FakeResult[]> => {
      ranOnBinding.push(`batch:${statements.length}`);
      return statements.map(() => ({ results: [], success: true, meta: {} }));
    },
    exec: async (sql: string) => {
      ranOnBinding.push(`exec:${sql}`);
      return { count: 1, duration: 0 };
    },
    withSession: (constraint?: string) => {
      opened.push(constraint ?? "<none>");
      return {
        prepare: (sql: string) =>
          statement(sql, ranInSession, { served_by_region: "WEUR", served_by_primary: false }, constraint),
        batch: async (statements: FakeStatement[]): Promise<FakeResult[]> => {
          // The runtime only accepts its own statement objects here, so assert
          // the wrapper unwrapped its tracking layer before forwarding.
          for (const candidate of statements) {
            expect(Object.getOwnPropertySymbols(candidate)).toHaveLength(0);
          }
          ranInSession.push(`batch:${statements.length}`);
          const refusal = constraint === undefined ? undefined : rejected.get(constraint);
          if (refusal) throw new Error(refusal);
          return statements.map(() => ({
            results: [],
            success: true,
            meta: { served_by_region: "APAC" },
          }));
        },
        getBookmark: () => bookmark,
      };
    },
  };

  return {
    binding,
    opened,
    ranOnBinding,
    ranInSession,
    setBookmark: (value: string | null) => {
      bookmark = value;
    },
    reject: (constraint: string, message = "D1_ERROR: Invalid bookmark") => {
      rejected.set(constraint, message);
    },
  };
}

const get = (headers?: Record<string, string>) =>
  new Request("https://example.test/dashboard", { headers });
const post = (headers?: Record<string, string>) =>
  new Request("https://example.test/api/items", { method: "POST", headers });

/** The two halves of an OAuth sign-in, which span two requests. */
const authSignIn = (headers?: Record<string, string>) =>
  new Request("https://example.test/api/auth/sign-in/social", { method: "POST", headers });
const authCallback = (headers?: Record<string, string>) =>
  new Request("https://example.test/api/auth/callback/google?state=abc&code=xyz", { headers });

describe("session constraints", () => {
  it("starts reads on any replica and writes on the primary", async () => {
    const d1 = fakeD1();
    const db = sessionedD1(d1.binding);

    await runWithD1Session(get(), undefined, () => db.prepare("select 1").run());
    await runWithD1Session(post(), undefined, () => db.prepare("insert 1").run());

    expect(d1.opened).toEqual(["first-unconstrained", "first-primary"]);
  });

  /**
   * A sign-in writes its OAuth state row on one request and the provider's
   * callback reads it back on the next, so a callback answered by a replica
   * that has not caught up finds nothing — which better-auth reports as
   * `state_mismatch` and the visitor sees as a dead-end error page instead of
   * being signed in. Auth therefore always starts on the primary, whatever
   * bookmark the browser sent and whatever mode is configured.
   */
  it("starts every auth request on the primary", async () => {
    const d1 = fakeD1();
    const db = sessionedD1(d1.binding);

    await runWithD1Session(authSignIn(), undefined, () => db.prepare("insert 1").run());
    await runWithD1Session(authCallback(), undefined, () => db.prepare("select 1").run());

    expect(d1.opened).toEqual(["first-primary", "first-primary"]);
  });

  it("ignores the client's bookmark on an auth request", async () => {
    const d1 = fakeD1();
    const db = sessionedD1(d1.binding);

    await runWithD1Session(
      authCallback({ cookie: `${D1_BOOKMARK_COOKIE}=0000001-0000002` }),
      undefined,
      () => db.prepare("select 1").run(),
    );

    expect(d1.opened).toEqual(["first-primary"]);
  });

  it("keeps auth on the primary even under the unconstrained override", async () => {
    const d1 = fakeD1();
    const db = sessionedD1(d1.binding);

    await runWithD1Session(authCallback(), "unconstrained", () => db.prepare("select 1").run());
    await runWithD1Session(get(), "unconstrained", () => db.prepare("select 1").run());

    expect(d1.opened).toEqual(["first-primary", "first-unconstrained"]);
  });

  it("does not mistake a lookalike path for an auth route", async () => {
    const d1 = fakeD1();
    const db = sessionedD1(d1.binding);

    await runWithD1Session(
      new Request("https://example.test/api/authors"),
      undefined,
      () => db.prepare("select 1").run(),
    );

    expect(d1.opened).toEqual(["first-unconstrained"]);
  });

  it("resumes from the client's bookmark, header or cookie", async () => {
    const d1 = fakeD1();
    const db = sessionedD1(d1.binding);

    await runWithD1Session(get({ [D1_BOOKMARK_HEADER]: "0000001-0000002" }), undefined, () =>
      db.prepare("select 1").run(),
    );
    await runWithD1Session(
      get({ cookie: `other=x; ${D1_BOOKMARK_COOKIE}=0000003-0000004` }),
      undefined,
      () => db.prepare("select 1").run(),
    );

    expect(d1.opened).toEqual(["0000001-0000002", "0000003-0000004"]);
  });

  it("ignores a bookmark that is not shaped like one", async () => {
    const d1 = fakeD1();
    const db = sessionedD1(d1.binding);

    await runWithD1Session(get({ [D1_BOOKMARK_HEADER]: "'; drop table users --" }), undefined, () =>
      db.prepare("select 1").run(),
    );

    expect(d1.opened).toEqual(["first-unconstrained"]);
  });

  /**
   * `decodeURIComponent` throws on a malformed escape, and the cookie is read
   * in the Worker entry ahead of every route handler — so before this was
   * guarded, one unparseable `d1_bookmark` cookie was an exception on every
   * request that browser made, including routes that never touch D1.
   */
  it("ignores a bookmark cookie that cannot be percent-decoded", async () => {
    const d1 = fakeD1();
    const db = sessionedD1(d1.binding);

    for (const value of ["%", "%zz", "0000001-000000%E0%A4%A"]) {
      await runWithD1Session(get({ cookie: `${D1_BOOKMARK_COOKIE}=${value}` }), undefined, () =>
        db.prepare("select 1").run(),
      );
    }

    expect(d1.opened).toEqual([
      "first-unconstrained",
      "first-unconstrained",
      "first-unconstrained",
    ]);
  });

  it("honours the D1_SESSION_MODE override", async () => {
    const d1 = fakeD1();
    const db = sessionedD1(d1.binding);

    await runWithD1Session(get(), "primary", () => db.prepare("select 1").run());
    await runWithD1Session(post(), "unconstrained", () => db.prepare("select 1").run());
    // An unrecognised value is not an outage: fall back to "auto".
    await runWithD1Session(get(), "nonsense", () => db.prepare("select 1").run());

    expect(d1.opened).toEqual(["first-primary", "first-unconstrained", "first-unconstrained"]);
  });

  it("starts background work on the primary", async () => {
    const d1 = fakeD1();
    const db = sessionedD1(d1.binding);

    await runWithPrimaryD1Session(() => db.prepare("delete 1").run());

    expect(d1.opened).toEqual(["first-primary"]);
  });
});

describe("sessioned binding", () => {
  it("routes every query in a request through one session", async () => {
    const d1 = fakeD1();
    const db = sessionedD1(d1.binding);

    await runWithD1Session(get(), undefined, async () => {
      await db.prepare("select 1").bind(7).all();
      await db.batch([db.prepare("select 2"), db.prepare("select 3")]);
    });

    expect(d1.opened).toHaveLength(1);
    expect(d1.ranInSession).toEqual(["bind:select 1:7", "all:select 1", "batch:2"]);
    expect(d1.ranOnBinding).toEqual([]);
  });

  it("falls through to the plain binding outside a session scope", async () => {
    const d1 = fakeD1();
    const db = sessionedD1(d1.binding);

    await db.prepare("select 1").run();

    expect(d1.opened).toEqual([]);
    expect(d1.ranOnBinding).toEqual(["run:select 1"]);
  });

  it("bypasses the Sessions API when the mode is off", async () => {
    const d1 = fakeD1();
    const db = sessionedD1(d1.binding);

    await runWithD1Session(get(), "off", () => db.prepare("select 1").run());

    expect(d1.opened).toEqual([]);
    expect(d1.ranOnBinding).toEqual(["run:select 1"]);
  });

  it("passes methods it does not intercept through to the binding", async () => {
    const d1 = fakeD1();
    const db = sessionedD1(d1.binding);

    await runWithD1Session(get(), undefined, () => db.exec("pragma foreign_keys = on"));

    expect(d1.ranOnBinding).toEqual(["exec:pragma foreign_keys = on"]);
  });

  it("reports which D1 instance answered the last query", async () => {
    const d1 = fakeD1();
    const db = sessionedD1(d1.binding);

    const info = await runWithD1Session(get(), undefined, async () => {
      await db.prepare("select 1").run();
      return getD1ReplicaInfo();
    });

    expect(info).toEqual({ region: "WEUR", primary: false });
  });
});

describe("bookmark propagation", () => {
  it("returns the session's closing bookmark on the response", async () => {
    const d1 = fakeD1();
    d1.setBookmark("0000005-0000006");
    const db = sessionedD1(d1.binding);

    const response = await runWithD1Session(get(), undefined, async () => {
      await db.prepare("select 1").run();
      return applyD1Bookmark(new Response("ok"));
    });

    expect(response.headers.get(D1_BOOKMARK_HEADER)).toBe("0000005-0000006");
    expect(response.headers.get("set-cookie")).toContain(`${D1_BOOKMARK_COOKIE}=0000005-0000006`);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });

  it("keeps the cookie off responses that never touched D1", () => {
    const d1 = fakeD1();
    d1.setBookmark("0000005-0000006");
    sessionedD1(d1.binding);

    const response = runWithD1Session(get(), undefined, () => {
      expect(getD1Bookmark()).toBeNull();
      return applyD1Bookmark(new Response("static"));
    });

    expect(d1.opened).toEqual([]);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get(D1_BOOKMARK_HEADER)).toBeNull();
  });

  it("preserves Set-Cookie headers the app already wrote", async () => {
    const d1 = fakeD1();
    d1.setBookmark("0000005-0000006");
    const db = sessionedD1(d1.binding);

    const response = await runWithD1Session(post(), undefined, async () => {
      await db.prepare("insert 1").run();
      const original = new Response("ok");
      original.headers.append("set-cookie", "session=abc; Path=/");
      return applyD1Bookmark(original);
    });

    const cookies = response.headers.getSetCookie();
    expect(cookies).toHaveLength(2);
    expect(cookies[0]).toContain("session=abc");
    expect(cookies[1]).toContain(D1_BOOKMARK_COOKIE);
  });

  it("adds the replica-routing headers only in debug mode", async () => {
    const d1 = fakeD1();
    d1.setBookmark("0000005-0000006");
    const db = sessionedD1(d1.binding);

    const plain = await runWithD1Session(get(), undefined, async () => {
      await db.prepare("select 1").run();
      return applyD1Bookmark(new Response("ok"));
    });
    const debug = await runWithD1Session(get(), undefined, async () => {
      await db.prepare("select 1").run();
      return applyD1Bookmark(new Response("ok"), { debug: true });
    });

    expect(plain.headers.get("x-d1-served-by-region")).toBeNull();
    expect(debug.headers.get("x-d1-served-by-region")).toBe("WEUR");
    expect(debug.headers.get("x-d1-served-by-primary")).toBe("false");
  });

  it("expires the cookie when the client's bookmark had to be dropped", async () => {
    const d1 = fakeD1();
    d1.reject("stale-bookmark");
    const db = sessionedD1(d1.binding);

    const response = await runWithD1Session(get({ cookie: `${D1_BOOKMARK_COOKIE}=stale-bookmark` }), undefined, async () => {
      await db.prepare("select 1").run();
      return applyD1Bookmark(new Response("ok"));
    });

    expect(response.headers.getSetCookie()).toEqual([
      `${D1_BOOKMARK_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax; Secure; HttpOnly`,
    ]);
  });

  it("round-trips a bookmark from one request into the next", async () => {
    const d1 = fakeD1();
    d1.setBookmark("0000007-0000008");
    const db = sessionedD1(d1.binding);

    const first = await runWithD1Session(post(), undefined, async () => {
      await db.prepare("insert 1").run();
      return applyD1Bookmark(new Response("ok"));
    });

    const cookie = first.headers.getSetCookie()[0].split(";")[0];
    await runWithD1Session(get({ cookie }), undefined, () => db.prepare("select 1").run());

    expect(d1.opened).toEqual(["first-primary", "0000007-0000008"]);
  });
});

/**
 * A bookmark reaches the Worker in a cookie the browser keeps re-sending, so a
 * bookmark D1 will not honour — minted before a restore, older than D1 keeps,
 * or simply not this database's — used to fail every D1-backed route for that
 * one browser until the cookie aged out. It is only ever a consistency floor,
 * so the request continues without it instead.
 */
describe("recovering from a bookmark D1 refuses", () => {
  it("retries a read on a fresh session and returns the row", async () => {
    const d1 = fakeD1();
    d1.reject("stale-bookmark");
    const db = sessionedD1(d1.binding);

    await runWithD1Session(get({ [D1_BOOKMARK_HEADER]: "stale-bookmark" }), undefined, () =>
      db.prepare("select 1").all(),
    );

    expect(d1.opened).toEqual(["stale-bookmark", "first-unconstrained"]);
    expect(d1.ranInSession).toEqual(["all:select 1", "all:select 1"]);
  });

  it("replays the statement with its bindings intact", async () => {
    const d1 = fakeD1();
    d1.reject("stale-bookmark");
    const db = sessionedD1(d1.binding);

    await runWithD1Session(get({ [D1_BOOKMARK_HEADER]: "stale-bookmark" }), undefined, () =>
      db.prepare("select ?").bind("alice").first(),
    );

    expect(d1.ranInSession).toEqual([
      "bind:select ?:alice",
      "first:select ?",
      "bind:select ?:alice",
      "first:select ?",
    ]);
  });

  it("drops the bookmark once, not once per statement", async () => {
    const d1 = fakeD1();
    d1.reject("stale-bookmark");
    const db = sessionedD1(d1.binding);

    await runWithD1Session(get({ [D1_BOOKMARK_HEADER]: "stale-bookmark" }), undefined, async () => {
      await db.prepare("select 1").all();
      await db.prepare("select 2").all();
    });

    expect(d1.opened).toEqual(["stale-bookmark", "first-unconstrained"]);
  });

  it("gives up rather than looping when the fresh session fails too", async () => {
    const d1 = fakeD1();
    d1.reject("stale-bookmark");
    d1.reject("first-unconstrained", "D1_ERROR: no such table");
    const db = sessionedD1(d1.binding);

    await expect(
      runWithD1Session(get({ [D1_BOOKMARK_HEADER]: "stale-bookmark" }), undefined, () =>
        db.prepare("select 1").all(),
      ),
    ).rejects.toThrow("no such table");
    expect(d1.opened).toEqual(["stale-bookmark", "first-unconstrained"]);
  });

  it("retries a batch on a fresh session", async () => {
    const d1 = fakeD1();
    d1.reject("stale-bookmark");
    const db = sessionedD1(d1.binding);

    await runWithD1Session(get({ [D1_BOOKMARK_HEADER]: "stale-bookmark" }), undefined, () =>
      db.batch([db.prepare("select 1"), db.prepare("select 2")]),
    );

    expect(d1.opened).toEqual(["stale-bookmark", "first-unconstrained"]);
    expect(d1.ranInSession).toEqual(["batch:2", "batch:2"]);
  });

  it("does not replay a write unless D1 blamed the bookmark", async () => {
    const d1 = fakeD1();
    d1.reject("stale-bookmark", "D1_ERROR: UNIQUE constraint failed");
    const db = sessionedD1(d1.binding);

    await expect(
      runWithD1Session(post({ [D1_BOOKMARK_HEADER]: "stale-bookmark" }), undefined, () =>
        db.prepare("insert 1").run(),
      ),
    ).rejects.toThrow("UNIQUE constraint failed");
    expect(d1.opened).toEqual(["stale-bookmark"]);
  });

  it("replays a write on the primary when D1 blamed the bookmark", async () => {
    const d1 = fakeD1();
    d1.reject("stale-bookmark", "D1_ERROR: Invalid bookmark");
    const db = sessionedD1(d1.binding);

    await runWithD1Session(post({ [D1_BOOKMARK_HEADER]: "stale-bookmark" }), undefined, () =>
      db.prepare("insert 1").run(),
    );

    expect(d1.opened).toEqual(["stale-bookmark", "first-primary"]);
  });

  it("leaves a failure alone when the request sent no bookmark", async () => {
    const d1 = fakeD1();
    d1.reject("first-unconstrained", "D1_ERROR: no such table");
    const db = sessionedD1(d1.binding);

    await expect(
      runWithD1Session(get(), undefined, () => db.prepare("select 1").all()),
    ).rejects.toThrow("no such table");
    expect(d1.opened).toEqual(["first-unconstrained"]);
  });
});
