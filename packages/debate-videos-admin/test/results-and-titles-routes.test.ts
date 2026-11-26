/**
 * @fileoverview The college-results, computed-titles and tournament-years
 * admin routes: who may call them, how they read the request, what they hand
 * the job, and how a failure comes back. The jobs themselves are tested in the
 * web app.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN, MODERATOR, access } from "./helpers/access";
import { freshDb, request, type DB } from "./helpers/db";

vi.mock("@/lib/auth/session", async () => (await import("./helpers/access")).sessionMock);
vi.mock("@/lib/database/context", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...(await import("./helpers/access")).contextMock,
}));

const jobs = vi.hoisted(() => ({
  fillCollegeResults: vi.fn(),
  listCollegeResultRows: vi.fn(),
  fillComputedTitles: vi.fn(),
  stripTournamentYears: vi.fn(),
}));
vi.mock("@/lib/videos/fill-college-results", () => ({
  UNSETTLED_STATUSES: ["not_found", "ambiguous", "error", "conflict", "winner_not_explicit"],
  fillCollegeResults: jobs.fillCollegeResults,
  listCollegeResultRows: jobs.listCollegeResultRows,
}));
vi.mock("@/lib/videos/fill-computed-titles", () => ({ fillComputedTitles: jobs.fillComputedTitles }));
vi.mock("@/lib/videos/strip-tournament-years", () => ({ stripTournamentYears: jobs.stripTournamentYears }));

const collegeResults = await import("../src/api/admin/videos/college-results");
const computedTitles = await import("../src/api/admin/videos/computed-titles");
const tournamentYears = await import("../src/api/admin/videos/tournament-years");

let db: DB;

const d1Error = () =>
  Object.assign(new Error("Failed query: update videos"), { cause: new Error("too many SQL variables") });

beforeEach(async () => {
  vi.stubEnv("ADMIN_EMAILS", ADMIN);
  vi.stubEnv("CARD_IMPORT_TOKEN", "");
  db = await freshDb();
  access.db = db;
  access.email = ADMIN;
  for (const job of Object.values(jobs)) job.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("admin-only", () => {
  it.each([
    ["college results list", () => collegeResults.GET(request("/x?status=error"))],
    ["college results lookup", () => collegeResults.POST(request("/x", { method: "POST", body: {} }))],
    ["computed titles", () => computedTitles.POST(request("/x", { method: "POST", body: {} }))],
  ])("%s refuses a moderator", async (_label, call) => {
    access.email = MODERATOR;
    expect((await call()).status).toBe(403);
    expect(Object.values(jobs).every((job) => job.mock.calls.length === 0)).toBe(true);
  });
});

describe("college results", () => {
  it("lists unsettled rounds for the requested statuses, ignoring unknown ones", async () => {
    jobs.listCollegeResultRows.mockResolvedValue({ rows: [{ videoId: "a" }], total: 1 });
    const res = await collegeResults.GET(request("/x?status=ambiguous, bogus ,conflict"));
    expect(await res.json()).toEqual({ rows: [{ videoId: "a" }], total: 1 });
    expect(jobs.listCollegeResultRows).toHaveBeenCalledWith(db, ["ambiguous", "conflict"]);
  });

  it("defaults to not_found, including when every requested status is unknown", async () => {
    jobs.listCollegeResultRows.mockResolvedValue({ rows: [], total: 0 });
    await collegeResults.GET(request("/x"));
    await collegeResults.GET(request("/x?status=nope"));
    expect(jobs.listCollegeResultRows.mock.calls.map((call) => call[1])).toEqual([["not_found"], ["not_found"]]);
  });

  it("reports a failing list as a 500", async () => {
    jobs.listCollegeResultRows.mockRejectedValue(new Error("db down"));
    const res = await collegeResults.GET(request("/x"));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Failed to list college results");
  });

  it("passes a numeric since to the lookup and merges the result", async () => {
    jobs.fillCollegeResults.mockResolvedValue({ checked: 10, remaining: 4 });
    const res = await collegeResults.POST(request("/x", { method: "POST", body: { since: 1700000000 } }));
    expect(await res.json()).toEqual({ ok: true, checked: 10, remaining: 4 });
    expect(jobs.fillCollegeResults).toHaveBeenCalledWith(db, { since: 1700000000 });
  });

  it.each([[{}], [{ since: "123" }], [{ since: null }]])("treats since %j as 0", async (body) => {
    jobs.fillCollegeResults.mockResolvedValue({});
    await collegeResults.POST(request("/x", { method: "POST", body }));
    expect(jobs.fillCollegeResults).toHaveBeenCalledWith(db, { since: 0 });
  });

  it("treats a missing body as since 0", async () => {
    jobs.fillCollegeResults.mockResolvedValue({});
    await collegeResults.POST(new Request("http://x/x", { method: "POST" }));
    expect(jobs.fillCollegeResults).toHaveBeenCalledWith(db, { since: 0 });
  });

  it("reports D1's cause, or the message when there is none", async () => {
    jobs.fillCollegeResults.mockRejectedValueOnce(d1Error());
    const res = await collegeResults.POST(request("/x", { method: "POST", body: {} }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to fill college results", details: "too many SQL variables" });

    jobs.fillCollegeResults.mockRejectedValueOnce(new Error("x".repeat(600)));
    const plain = await collegeResults.POST(request("/x", { method: "POST", body: {} }));
    expect((await plain.json()).details).toBe("x".repeat(500));
  });
});

describe("computed titles", () => {
  it("passes an integer season through", async () => {
    jobs.fillComputedTitles.mockResolvedValue({ season: 2024, updated: 5, nextSeason: 2025 });
    const res = await computedTitles.POST(request("/x", { method: "POST", body: { season: 2024 } }));
    expect(await res.json()).toEqual({ ok: true, season: 2024, updated: 5, nextSeason: 2025 });
    expect(jobs.fillComputedTitles).toHaveBeenCalledWith(db, { season: 2024 });
  });

  it.each([[{ season: 2024.5 }], [{ season: "2024" }], [{}]])("starts from the oldest season for %j", async (body) => {
    jobs.fillComputedTitles.mockResolvedValue({});
    await computedTitles.POST(request("/x", { method: "POST", body }));
    expect(jobs.fillComputedTitles).toHaveBeenCalledWith(db, { season: null });
  });

  it("starts from the oldest season with no body", async () => {
    jobs.fillComputedTitles.mockResolvedValue({});
    await computedTitles.POST(new Request("http://x/x", { method: "POST" }));
    expect(jobs.fillComputedTitles).toHaveBeenCalledWith(db, { season: null });
  });

  it("reports D1's cause", async () => {
    jobs.fillComputedTitles.mockRejectedValue(d1Error());
    const res = await computedTitles.POST(request("/x", { method: "POST", body: {} }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to fill computed titles", details: "too many SQL variables" });
  });
});

describe("tournament years", () => {
  it("returns the job's result", async () => {
    jobs.stripTournamentYears.mockResolvedValue({ renamed: 2, rows: 3, remaining: 0, examples: [] });
    const res = await tournamentYears.POST();
    expect(await res.json()).toEqual({ ok: true, renamed: 2, rows: 3, remaining: 0, examples: [] });
    expect(jobs.stripTournamentYears).toHaveBeenCalledWith(db);
  });

  it("reports D1's cause, or the message when there is none", async () => {
    jobs.stripTournamentYears.mockRejectedValueOnce(d1Error());
    const res = await tournamentYears.POST();
    expect(res.status).toBe(500);
    expect((await res.json()).details).toBe("too many SQL variables");

    jobs.stripTournamentYears.mockRejectedValueOnce(new Error("plain failure"));
    expect((await (await tournamentYears.POST()).json()).details).toBe("plain failure");
  });
});
