import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { parseClassicParadigmPage, readJudgeRecord, readParadigmDetails, summarizeJudgeRecord, type JudgeRecordRow } from "../src/paradigms";
import { fetchTabroomJudge, sanitizeParadigmHtml, searchTabroomParadigms } from "../src/paradigms-server";

const page = readFileSync(new URL("./fixtures/classic-paradigm.html", import.meta.url), "utf8");

const row = (vote: string, panelVote: string, record: string, event = "VPF"): JudgeRecordRow => ({
  Tourn: { id: 1, name: "Blake" },
  roundDate: "2025-10-04T00:00:00.000Z",
  roundLabel: "R1",
  eventAbbr: event,
  affTeam: "A",
  affLabel: "Pro",
  negTeam: "B",
  negLabel: "Con",
  vote,
  panelVote,
  record,
});

describe("judging records", () => {
  it("tallies sides, panels and squirrels", () => {
    const summary = summarizeJudgeRecord([row("Pro", "Pro", "1-0"), row("Con", "Pro", "2-1", "VCX"), row("Con", "Con", "1-2"), row("Pro", "Con", "1-2")]);
    expect(summary).toMatchObject({ rounds: 4, affVotes: 2, negVotes: 2, panels: 3, squirrels: 2 });
    expect(summary.events[0]).toEqual({ event: "VPF", rounds: 3 });
  });

  it("reads the API's record and paradigm bodies, ignoring junk", () => {
    expect(readJudgeRecord([{ Tourn: { id: 5, name: "TOC" }, vote: "Aff", record: "1-0" }, null, 3])).toEqual([
      expect.objectContaining({ Tourn: { id: 5, name: "TOC" }, vote: "Aff", affLabel: "Aff", negLabel: "Neg", record: "1-0" }),
    ]);
    expect(readJudgeRecord({ error: 1 })).toEqual([]);
    expect(readParadigmDetails({ id: 7, name: "Jo", paradigm: "<p>x</p>", lastReviewed: null, certifications: [{ label: "NSDA" }] })).toEqual({
      id: 7,
      name: "Jo",
      paradigm: "<p>x</p>",
      lastReviewed: null,
      certifications: [{ label: "NSDA", description: null }],
    });
    expect(readParadigmDetails({ type: "about:blank", status: 404 })).toBeNull();
  });
});

describe("the classic paradigm page", () => {
  it("reads the name, statement, review date and judging record", () => {
    const parsed = parseClassicParadigmPage(page);
    expect(parsed.name).toBe("Jane Doe");
    expect(parsed.paradigmHtml).toContain("Tech over truth.");
    expect(parsed.paradigmHtml).toContain("Theory is fine.");
    expect(parsed.lastReviewed).toContain("September 6, 2025");
    expect(parsed.record).toHaveLength(2);
    expect(parsed.record[0]).toMatchObject({
      Tourn: { id: 31000, name: "Glenbrooks" },
      roundDate: "11/18/2023",
      eventAbbr: "VCX",
      roundLabel: "Octas",
      affTeam: "Harker LL",
      negTeam: "Lexington AB",
      vote: "Aff",
      panelVote: "Neg",
      record: "1-2",
    });
    // A one-judge round with no result cell: the vote is the decision, and "Con" names the neg side.
    expect(parsed.record[1]).toMatchObject({ vote: "Con", panelVote: "Con", negLabel: "Con", record: "0-1" });
    expect(summarizeJudgeRecord(parsed.record).squirrels).toBe(1);
  });
});

describe("sanitizing", () => {
  it("keeps rich text and drops scripts, handlers and javascript: links", () => {
    const clean = sanitizeParadigmHtml('<p onclick="x()"><b>Bold</b> <a href="javascript:alert(1)">bad</a> <a href="https://x.org">ok</a></p><script>alert(1)</script>');
    expect(clean).toContain("<b>Bold</b>");
    expect(clean).not.toMatch(/script|onclick|javascript:/);
    expect(clean).toContain('href="https://x.org"');
    expect(clean).toContain('rel="noopener noreferrer nofollow"');
  });
});

describe("fetching from Tabroom", () => {
  const credentials = { token: "secret" };
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  it("refuses without a session rather than guessing", async () => {
    const fetchImpl = vi.fn();
    expect(await fetchTabroomJudge(1, { fetchImpl })).toMatchObject({ ok: false, reason: "unauthorized" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reads the API with the session cookie", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("cookie")).toBe("TabroomToken=secret");
      return String(url).endsWith("/record")
        ? json([{ Tourn: { id: 2, name: "Yale" }, vote: "Aff", panelVote: "Aff", record: "3-0", affLabel: "Aff", negLabel: "Neg" }])
        : json({ id: 9, name: "Sam Lee", paradigm: "<p>Hi</p><script>x</script>", lastReviewed: "2025-09-01T00:00:00.000Z" });
    }) as unknown as typeof fetch;
    const result = await fetchTabroomJudge(9, { credentials, fetchImpl });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile).toMatchObject({ personId: 9, name: "Sam Lee", paradigmHtml: "<p>Hi</p>", source: "tabroom-api" });
    expect(result.profile.record).toHaveLength(1);
  });

  it("falls back to the classic page when the API refuses", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) =>
      String(url).includes("api.tabroom.com") ? json({ title: "Unauthorized" }, 401) : new Response(page, { status: 200 }),
    ) as unknown as typeof fetch;
    const result = await fetchTabroomJudge(4242, { credentials, fetchImpl });
    expect(result).toMatchObject({ ok: true, profile: { name: "Jane Doe", source: "tabroom-page" } });
    if (result.ok) expect(result.profile.paradigmHtml).not.toContain("script");
  });

  it("reports a login page as unauthorized", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) =>
      String(url).includes("api.tabroom.com")
        ? json({}, 401)
        : new Response('<form action="/user/login/login_save.mhtml"><input name="password"></form>', { status: 200 }),
    ) as unknown as typeof fetch;
    expect(await fetchTabroomJudge(4242, { credentials, fetchImpl })).toMatchObject({ ok: false, reason: "unauthorized" });
  });

  it("pages through the paradigm search", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      expect(new URL(String(url)).searchParams.get("offset")).toBe("100");
      return json([{ id: 1, name: "A B", tournJudged: 3 }, { bad: true }]);
    }) as unknown as typeof fetch;
    expect(await searchTabroomParadigms("", { offset: 100 }, { credentials, fetchImpl })).toEqual({ ok: true, hits: [{ id: 1, name: "A B", tournJudged: 3 }] });
  });
});
