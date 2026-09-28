import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { TournamentsApp } from "../src/ui";
import { createTournamentsClient } from "../src/ui/client";

describe("TournamentsApp", () => {
  it("server-renders the loading state for a tournament page", () => {
    const html = renderToString(<TournamentsApp segments={["12", "rounds"]} />);
    expect(html).toContain("Loading");
  });

  it("renders a not-found note for unknown paths", () => {
    expect(renderToString(<TournamentsApp segments={["nope"]} />)).toContain("does not exist");
  });
});

describe("createTournamentsClient", () => {
  it("builds API paths and surfaces problem details", async () => {
    const calls: string[] = [];
    const client = createTournamentsClient("/api/t/", async (url) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ detail: "No such tournament found" }), { status: 404 });
    });
    await expect(client.round(3, "PF", "2")).rejects.toThrow("No such tournament found");
    expect(calls).toEqual(["/api/t/pages/invite/3/PF/2"]);
  });
});
