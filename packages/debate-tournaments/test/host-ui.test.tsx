/**
 * The host page and the Tabroom overlay, rendered on the server so the markup
 * they produce is pinned without a DOM.
 */

import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import type { ReactNode } from "react";
import { FramedOverlay, TOURNAMENT_FORMATS, TournamentsApp } from "../src/ui";
import { TournamentsContext, type TournamentsContextValue } from "../src/ui/shared";
import { createTournamentsClient } from "../src/ui/client";

const plainLink = ({ href, children }: { href: string; children?: ReactNode }) => <a href={href}>{children}</a>;

function withClient(client: ReturnType<typeof createTournamentsClient>, node: ReactNode) {
  const value = {
    client,
    hrefs: { upcoming: () => "/t", host: () => "/t/host", tournament: (id: number) => `/t/${id}`, rounds: (id: number) => `/t/${id}/rounds`, round: () => "/t/1/rounds/LD/1", results: () => "/t/1/results", resultSet: () => "/t/1/results/2", tabroom: () => "/t/1/tabroom", admin: (id: number) => `/t/${id}/admin` },
    Link: plainLink,
  } as unknown as TournamentsContextValue;
  return renderToString(<TournamentsContext.Provider value={value}>{node}</TournamentsContext.Provider>);
}

const noFetch = () => Promise.resolve(new Response("{}", { status: 200 }));

describe("HostTournamentPage", () => {
  it("offers every debate format, each with its speech order explained", () => {
    const html = withClient(createTournamentsClient("/api/tabroom", noFetch), <TournamentsApp segments={["host"]} />);

    for (const format of TOURNAMENT_FORMATS) {
      expect(html).toContain(format.name);
      expect(html).toContain(format.blurb);
    }
    // Only Policy starts selected, so only Policy shows its per-style settings.
    expect(html).toContain("Entries per school");
    expect(html).toContain("1AC → 2AC → 1AR → 2AR vs 1NC → 2NC → 1NR → 2NR");
  });

  it("asks how the tournament is held, in the three ways Tabroom records", () => {
    const html = withClient(createTournamentsClient("/api/tabroom", noFetch), <TournamentsApp segments={["host"]} />);
    expect(html).toContain("Virtual");
    expect(html).toContain("In-Person");
    expect(html).toContain("Long-Term Online");
    expect(html).toContain("Registration closes");
  });

  it("posts to the host API rather than sending the host to Tabroom", async () => {
    const calls: Array<[string, RequestInit | undefined]> = [];
    const client = createTournamentsClient("/api/tabroom", async (url, init) => {
      calls.push([String(url), init]);
      return new Response(JSON.stringify({ tournament: { id: 9, name: "Test", webname: "test" } }), { status: 201 });
    });

    await client.createTournament({
      name: "Test Invitational",
      start: "2031-04-11T16:00:00.000Z",
      end: "2031-04-12T02:00:00.000Z",
      events: [{ format: "policy" }, { format: "pf", level: "novice" }],
    });

    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe("/api/tabroom/host/tourns");
    expect(calls[0][1]?.method).toBe("POST");
    const body = JSON.parse(String(calls[0][1]?.body));
    expect(body.events.map((event: any) => event.format)).toEqual(["policy", "pf"]);
  });

  it("reads a host's own tournaments from the host API", async () => {
    const calls: string[] = [];
    const client = createTournamentsClient("/api/tabroom", async (url) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ tournaments: [] }), { status: 200 });
    });
    await expect(client.myTournaments()).resolves.toEqual({ tournaments: [] });
    expect(calls).toEqual(["/api/tabroom/host/tourns"]);
  });
});

describe("FramedOverlay", () => {
  it("renders nothing until it is opened, so the framed page is not fetched with the list", () => {
    expect(renderToString(<FramedOverlay open={false} onClose={() => {}} />)).toBe("");
  });

  it("frames beta.tabroom.com over the page, with a way out", () => {
    const html = renderToString(<FramedOverlay open onClose={() => {}} />);
    expect(html).toContain('src="https://beta.tabroom.com"');
    expect(html).toContain("Close Tabroom overlay");
    expect(html).toContain("Open in a new tab");
    expect(html).toContain('role="dialog"');
  });

  it("frames any page, naming the close control for it", () => {
    const html = renderToString(
      <FramedOverlay open onClose={() => {}} url="/debate-majors-a-to-z.html" title="Debate Majors" />,
    );
    expect(html).toContain('src="/debate-majors-a-to-z.html"');
    expect(html).toContain("Close Debate Majors overlay");
  });

  it("is reachable from the tournaments list, next to the demo admin", () => {
    const html = renderToString(<TournamentsApp segments={[]} />);
    expect(html).toContain("Host Tournament");
    expect(html).toContain('href="/tournaments/90001/admin"');
    // Tabroom has its own sidebar row now; the list no longer frames it.
    expect(html).not.toContain(">Tabroom<");
  });

  it("offers the Debate Majors season calendar as an overlay of the list", () => {
    const html = renderToString(<TournamentsApp segments={[]} />);
    expect(html).toContain("Debate Majors");
    // The calendar page itself is only fetched once the overlay opens.
    expect(html).not.toContain("debate-majors-a-to-z.html");
  });

  it("hosts on this site's API, never sending the host to Tabroom", () => {
    const html = withClient(createTournamentsClient("/api/tabroom", noFetch), <TournamentsApp segments={["host"]} />);
    expect(html).not.toContain("beta.tabroom.com");
    expect(html).not.toContain("Open Tabroom");
    expect(html).toContain("Try the demo admin");
    expect(html).toContain('href="/tournaments/90001/admin"');
  });
});

describe("createTournamentsClient host methods", () => {
  it("surfaces the API's reason for refusing a tournament", async () => {
    const client = createTournamentsClient("/api/tabroom", async () =>
      new Response(JSON.stringify({ detail: "Sign in to host a tournament." }), { status: 401 }),
    );
    await expect(client.createTournament({ name: "x", start: "a", end: "b", events: [] })).rejects.toThrow(
      "Sign in to host a tournament.",
    );
  });
});
