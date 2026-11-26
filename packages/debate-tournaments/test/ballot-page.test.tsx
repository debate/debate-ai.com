// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BallotAccountCheck, StoredJudgeBallot } from "../src/ballots";
import { BallotPage } from "../src/ui/pages/BallotPage";
import { click, contextValue, render, settle, submit, text, type as typeInto, unmountAll } from "./helpers/dom";

const account: BallotAccountCheck = {
  signedIn: true,
  email: "judge@example.com",
  tabroomPerson: { id: 4, name: "Jo Judge", email: "judge@example.com" },
  tabroomForwarding: true,
};

const stored = (over: Partial<StoredJudgeBallot> = {}): StoredJudgeBallot => ({
  id: "b1",
  tournId: 7,
  event: "VCX",
  round: "3",
  aff: "Alpha AB",
  neg: "Beta CD",
  winner: "aff",
  lowPointWin: false,
  speakerPoints: [],
  judgeEmail: "judge@example.com",
  tabroomEmail: "judge@example.com",
  destination: "local",
  tabroomStatus: null,
  tabroomDetail: null,
  createdAt: "2026-01-01T00:00:00Z",
  ...over,
});

interface Api {
  account: BallotAccountCheck | Response;
  ballots: StoredJudgeBallot[];
  post: (body: unknown, init: RequestInit) => Response;
}

function stubApi(api: Partial<Api> = {}) {
  const full: Api = { account, ballots: [], post: (body) => Response.json({ ballot: stored() }, { status: 201 }), ...api };
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (init?.method === "POST") return full.post(JSON.parse(String(init.body)), init);
      if (url.endsWith("/account")) return full.account instanceof Response ? full.account : Response.json(full.account);
      return Response.json({ ballots: full.ballots });
    }),
  );
  return calls;
}

const ctx = () => contextValue({ ballotApiBase: "/api/judge-ballots/" });
const field = (el: HTMLElement, id: string) => el.querySelector(`#${id}`);

async function fillRequired(el: HTMLElement) {
  await typeInto(field(el, "ballot-event"), "VCX");
  await typeInto(field(el, "ballot-round"), "3");
  await typeInto(field(el, "ballot-aff"), "Alpha AB");
  await typeInto(field(el, "ballot-neg"), "Beta CD");
  await click(el.querySelector('input[name="ballot-winner"][value="aff"]'));
}

beforeEach(() => {
  window.history.replaceState(null, "", "/");
});
afterEach(() => {
  unmountAll();
  vi.unstubAllGlobals();
});

describe("BallotPage", () => {
  it("says so when the host has no ballot API", async () => {
    const el = await render(<BallotPage tournId={7} />, contextValue());
    expect(text(el)).toContain("Ballot submission is not set up on this site.");
  });

  it("asks a signed-out visitor to sign in instead of showing the form", async () => {
    stubApi({ account: { signedIn: false, email: null, tabroomPerson: null, tabroomForwarding: false } });
    const el = await render(<BallotPage tournId={7} />, ctx());
    expect(text(el)).toContain("Sign in to Debate AI to submit a ballot");
    expect(el.querySelector("form")).toBeNull();
    expect(text(el)).not.toContain("Your ballots at this tournament");
  });

  it("surfaces an account check failure from the API", async () => {
    stubApi({ account: Response.json({ error: "Account service down" }, { status: 503 }) });
    const el = await render(<BallotPage tournId={7} />, ctx());
    expect(el.querySelector('[role="alert"]')?.textContent).toBe("Account service down");
  });

  it("prefills the pairing from the link's query string and the email from the Tabroom account", async () => {
    stubApi();
    window.history.replaceState(null, "", "/?event=VLD&round=Octas&room=12&aff=Alpha&neg=Beta&ignored=1");
    const el = await render(<BallotPage tournId={7} name="Harker Invitational" events={["VCX", "VLD"]} />, ctx());
    expect((field(el, "ballot-event") as HTMLInputElement).value).toBe("VLD");
    expect((field(el, "ballot-round") as HTMLInputElement).value).toBe("Octas");
    expect((field(el, "ballot-room") as HTMLInputElement).value).toBe("12");
    expect((field(el, "ballot-aff") as HTMLInputElement).value).toBe("Alpha");
    expect((field(el, "ballot-tabroom-email") as HTMLInputElement).value).toBe("judge@example.com");
    expect([...el.querySelectorAll("#ballot-events option")].map((o) => o.getAttribute("value"))).toEqual(["VCX", "VLD"]);
    expect(text(el)).toContain("Harker Invitational overview");
    expect(text(el)).toContain("Tabroom account: Jo Judge");
    expect(text(el)).toContain("Aff wins (Alpha)");
    expect(text(el)).toContain("Neg wins (Beta)");
  });

  it("blocks submission while the Tabroom email differs from the signed-in email", async () => {
    const calls = stubApi();
    const el = await render(<BallotPage tournId={7} />, ctx());
    await typeInto(field(el, "ballot-tabroom-email"), "someone@else.org");
    expect(text(el)).toContain("Must match the email you are signed in to Debate AI with (judge@example.com).");
    const button = el.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    await fillRequired(el);
    await submit(el.querySelector("form"));
    expect(text(el)).toContain("Your Tabroom account email must match the email you are signed in with.");
    expect(calls.some((c) => c.init?.method === "POST")).toBe(false);
  });

  it("reports validation errors without posting", async () => {
    const calls = stubApi();
    const el = await render(<BallotPage tournId={7} />, ctx());
    await submit(el.querySelector("form"));
    const message = el.querySelector('[role="alert"]')?.textContent ?? "";
    expect(message).toContain("event is required.");
    expect(message).toContain('winner must be "aff" or "neg".');
    expect(calls.some((c) => c.init?.method === "POST")).toBe(false);
  });

  it("posts the ballot with trimmed speaker points, then lists it and notes it was saved", async () => {
    let posted: Record<string, unknown> | null = null;
    const ballots: StoredJudgeBallot[] = [];
    const calls = stubApi({
      ballots,
      post: (body) => {
        posted = body as Record<string, unknown>;
        ballots.push(stored({ lowPointWin: true }));
        return Response.json({ ballot: stored() }, { status: 201 });
      },
    });
    const el = await render(<BallotPage tournId={7} name="Open" />, ctx());
    await fillRequired(el);
    await click(el.querySelector('input[type="checkbox"]'));
    await typeInto(el.querySelector('[aria-label="Speaker 1 name"]'), "Ann");
    await typeInto(el.querySelector('[aria-label="Speaker 1 points"]'), "28.5");
    await typeInto(el.querySelector('[aria-label="Speaker 3 name"]'), "Cy");
    await typeInto(el.querySelector('[aria-label="Speaker 3 points"]'), "27");
    await typeInto(field(el, "ballot-room"), "101");
    await typeInto(field(el, "ballot-rfd"), "Aff won the link turn.");
    await submit(el.querySelector("form"));

    expect(posted).toMatchObject({
      tournId: 7,
      tournamentName: "Open",
      event: "VCX",
      winner: "aff",
      lowPointWin: true,
      room: "101",
      rfd: "Aff won the link turn.",
      destination: "local",
      speakerPoints: [
        { speaker: "Ann", side: "aff", points: 28.5 },
        { speaker: "Cy", side: "neg", points: 27 },
      ],
    });
    const post = calls.find((c) => c.init?.method === "POST")!;
    expect(post.url).toBe("/api/judge-ballots");
    expect((post.init?.headers as Record<string, string>)["x-tabroom-token"]).toBeUndefined();
    expect(text(el)).toContain("Ballot submitted. Saved to Debate AI.");
    // The list reloads after a submit.
    expect(text(el)).toContain("Your ballots at this tournament");
    expect(text(el)).toContain("VCX 3: Alpha AB vs Beta CD");
    expect(text(el)).toContain("(low-point win)");
  });

  it("forwards to Tabroom with the judge's token header and reports how it went", async () => {
    const calls = stubApi({ post: () => Response.json({ ballot: stored({ tabroomStatus: "sent", destination: "tabroom" }) }, { status: 201 }) });
    const el = await render(<BallotPage tournId={7} />, ctx());
    await fillRequired(el);
    expect(field(el, "ballot-tabroom-token")).toBeNull();
    await typeInto(field(el, "ballot-destination"), "tabroom");
    await typeInto(field(el, "ballot-tabroom-token"), "  tok-123  ");
    await submit(el.querySelector("form"));
    const post = calls.find((c) => c.init?.method === "POST")!;
    expect((post.init?.headers as Record<string, string>)["x-tabroom-token"]).toBe("tok-123");
    expect(text(el)).toContain("Sent to Tabroom.");
  });

  it.each([
    ["failed", "Tabroom did not accept it: Bad token A copy is saved here."],
    ["unavailable", "Tabroom submission is not available, so it was saved here only."],
  ] as const)("explains a %s Tabroom forward", async (status, expected) => {
    stubApi({ post: () => Response.json({ ballot: stored({ tabroomStatus: status, tabroomDetail: status === "failed" ? "Bad token" : null }) }, { status: 201 }) });
    const el = await render(<BallotPage tournId={7} />, ctx());
    await fillRequired(el);
    await submit(el.querySelector("form"));
    expect(text(el)).toContain(expected);
  });

  it("shows the server's error list when it rejects the ballot", async () => {
    stubApi({ post: () => Response.json({ errors: ["Round is closed.", "Try later."] }, { status: 422 }) });
    const el = await render(<BallotPage tournId={7} />, ctx());
    await fillRequired(el);
    await submit(el.querySelector("form"));
    expect(el.querySelector('[role="alert"]')?.textContent).toBe("Round is closed. Try later.");
  });

  it("falls back to a status message when the rejection has no body", async () => {
    stubApi({ post: () => new Response("nope", { status: 500 }) });
    const el = await render(<BallotPage tournId={7} />, ctx());
    await fillRequired(el);
    await submit(el.querySelector("form"));
    expect(el.querySelector('[role="alert"]')?.textContent).toBe("Ballot was not submitted (500).");
  });

  it("tells the judge to retry when the network fails", async () => {
    stubApi({
      post: () => {
        throw new TypeError("offline");
      },
    });
    const el = await render(<BallotPage tournId={7} />, ctx());
    await fillRequired(el);
    await submit(el.querySelector("form"));
    expect(el.querySelector('[role="alert"]')?.textContent).toContain("could not be sent");
    await settle();
  });

  it("falls back to local-only and disables Tabroom when forwarding is not set up", async () => {
    stubApi({ account: { ...account, tabroomForwarding: false } });
    const el = await render(<BallotPage tournId={7} />, ctx());
    const tabroomOption = el.querySelector('#ballot-destination option[value="tabroom"]') as HTMLOptionElement;
    expect(tabroomOption.disabled).toBe(true);
    expect(tabroomOption.textContent).toContain("not set up on this site");
    expect((field(el, "ballot-destination") as HTMLSelectElement).value).toBe("local");
  });

  it("labels each stored ballot with where it ended up", async () => {
    stubApi({
      ballots: [
        stored({ id: "1", tabroomStatus: "sent" }),
        stored({ id: "2", winner: "neg", tabroomStatus: "failed" }),
        stored({ id: "3" }),
      ],
    });
    const el = await render(<BallotPage tournId={7} />, ctx());
    const items = [...el.querySelectorAll("ul li")].map((li) => li.textContent);
    expect(items[0]).toContain("On Tabroom");
    expect(items[1]).toContain("Beta CD");
    expect(items[1]).toContain("Tabroom failed");
    expect(items[2]).toContain("Debate AI");
  });
});
