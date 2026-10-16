/**
 * The host page and the Tabroom overlay, rendered on the server so the markup
 * they produce is pinned without a DOM.
 */

import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import type { ReactNode } from "react";
import {
  FramedOverlay,
  HostedTournamentButton,
  TOURNAMENT_FORMATS,
  TournamentNav,
  TournamentsApp,
  type OwnedTournament,
} from "../src/ui";
import { tournamentHrefs, type TournamentHrefs } from "../src/routes";
import { TournamentsContext, type TournamentsContextValue } from "../src/ui/shared";
import { createTournamentsClient, type TournamentAdmin } from "../src/ui/client";
import { AdminView } from "../src/ui/pages/TournamentAdminPage";

const plainLink = ({
  href,
  className,
  title,
  "aria-label": ariaLabel,
  children,
}: {
  href: string;
  className?: string;
  title?: string;
  "aria-label"?: string;
  children?: ReactNode;
}) => (
  <a href={href} className={className} title={title} aria-label={ariaLabel}>
    {children}
  </a>
);

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

describe("HostedTournamentButton", () => {
  const owned = (id: number, name: string): OwnedTournament => ({
    id,
    name,
    webname: null,
    start: null,
    end: null,
    tz: null,
    hidden: false,
    eventCount: 0,
  });
  const hrefs = { admin: (id: number) => `/t/${id}/admin` } as unknown as TournamentHrefs;

  it("shows the newest tournament the user hosts, opening its admin view", () => {
    const html = renderToString(
      <HostedTournamentButton
        tournaments={[owned(42, "Golden Gate Invitational"), owned(7, "Earlier Classic")]}
        hrefs={hrefs}
        Link={plainLink}
      />,
    );
    expect(html).toContain("Golden Gate Invitational");
    expect(html).toContain('href="/t/42/admin"');
    // The older one is counted by the badge, not listed.
    expect(html).toContain(">2</span>");
    expect(html).not.toContain("Earlier Classic");
    expect(html).toContain(
      "Open the admin view of Golden Gate Invitational, the newest of your 2 hosted tournaments",
    );
  });

  it("renders nothing when the user hosts nothing", () => {
    expect(
      renderToString(<HostedTournamentButton tournaments={[]} hrefs={hrefs} Link={plainLink} />),
    ).toBe("");
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

describe("the admin view's mock-data editor", () => {
  const view = (id: number): TournamentAdmin => ({
    viewer: { username: "demo.admin", name: "Demo Admin", mock: true },
    tourn: { id, name: "Demo", webname: null, city: null, state: null, country: null, tz: null, start: null, end: null, regStart: null, regEnd: null, hidden: false },
    events: [],
    schools: [],
    entries: [{ id: 1, code: "BV DW", name: "Dubois & Weber", eventAbbr: "VCX", schoolName: "Bay View", status: "active" }],
    judges: [],
    rooms: [],
    rounds: [],
    resultSets: [],
  });
  const client = createTournamentsClient("/api/tabroom", noFetch);

  it("shows on the demo tournament, with a reset", () => {
    const html = withClient(client, <AdminView view={view(90001)} onChanged={() => {}} />);
    expect(html).toContain("Edit mock data");
    expect(html).toContain("Reset demo data");
    expect(html).toContain('value="Dubois &amp; Weber"');
  });

  it("is absent from any other tournament", () => {
    expect(withClient(client, <AdminView view={view(42)} onChanged={() => {}} />)).not.toContain("Edit mock data");
  });

  it("adds upstream's tournament setup for a real owner, not the mock admin", () => {
    expect(withClient(client, <AdminView view={view(42)} />)).not.toContain("Tournament setup");
    const owned = { ...view(42), viewer: { username: "olive", name: "Olive", mock: false } };
    expect(withClient(client, <AdminView view={owned} />)).toContain("Tournament setup");
  });
});

describe("the tournament setup client", () => {
  it("reads timeslots and judge categories from upstream's tab API", async () => {
    const seen: string[] = [];
    const client = createTournamentsClient("/api/tabroom", async (input) => {
      const url = String(input);
      seen.push(url);
      const body = url.endsWith("/timeslots") ? [{ id: 400, name: "Round 1", start: null, end: null }] : [{ id: 10, name: "Debate Judges", abbr: "DJ" }];
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    });
    const setup = await client.setup(7);
    expect(seen).toEqual(["/api/tabroom/tab/tourns/7/timeslots", "/api/tabroom/tab/tourns/7/categories"]);
    expect(setup.timeslots[0]?.name).toBe("Round 1");
    expect(setup.categories[0]?.abbr).toBe("DJ");
  });
});

describe("TournamentNav ballot tab", () => {
  const hrefs = tournamentHrefs("/t");
  const render = (ballotApiBase?: string) =>
    renderToString(
      <TournamentsContext.Provider
        value={{ client: createTournamentsClient("/api/tabroom", noFetch), hrefs, Link: plainLink, ballotApiBase }}
      >
        <TournamentNav tournId={7} active="ballot" source="tabroom" />
      </TournamentsContext.Provider>,
    );

  it("shows a Ballot tab when the host has a ballot API", () => {
    const html = render("/api/judge-ballots");
    expect(html).toContain('href="/t/7/ballot"');
    expect(html).toContain(">Ballot<");
  });

  it("hides it otherwise", () => {
    expect(render()).not.toContain("/t/7/ballot");
  });
});
