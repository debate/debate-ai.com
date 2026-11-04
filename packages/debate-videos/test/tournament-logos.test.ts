/**
 * @fileoverview Pins that a tournament resolves to its host school's logo by
 * any spelling of the school, that every school png reaches the tournament
 * lookup, and that the Shirley shows Wake Forest's logo with a "Shirley" badge.
 */

import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  getTournamentBadge,
  getTournamentLogo,
} from "../src/components/videos/card/tournamentLogos";

/** Every college, high-school and tournament-organization png (the Debate AI logo is not a tournament). */
const SCHOOL_PNGS = ["colleges", "high-schools", "organizations"]
  .flatMap((folder) =>
    readdirSync(fileURLToPath(new URL(`../../debate-icons/schools/${folder}`, import.meta.url))),
  )
  .filter((file) => file.endsWith(".png"))
  .map((file) => file.replace(/\.png$/, ""))
  .filter((name) => name !== "debate-ai");

describe("getTournamentLogo", () => {
  it.each(SCHOOL_PNGS)("resolves the %s logo", (name) => {
    expect(getTournamentLogo(name.replace(/-/g, " "))).toBeTruthy();
  });

  it.each(["Shirley", "2025 Shirley", "Shirley 2019 Rd 6", "Franklin R. Shirley Classic"])(
    "shows Wake Forest's logo for %s",
    (name) => {
      expect(getTournamentLogo(name)).toBe(getTournamentLogo("Wake Forest"));
      expect(getTournamentBadge(name)).toBe("Shirley");
    },
  );

  it("badges nothing but the Shirley", () => {
    expect(getTournamentBadge("Wake Forest")).toBeNull();
    expect(getTournamentBadge("Harvard 2024")).toBeNull();
  });

  it.each([
    ["University of KY", "Kentucky"],
    ["University of Kentucky 2018", "Kentucky"],
    ["Bronx", "Bronx Science"],
    ["Glenbrook South", "GBS"],
    ["Dartmouth RR 2024", "Dartmouth"],
    ["NSDA Nationals", "NSDA"],
    ["USC", "Southern California"],
  ])("resolves %s like %s", (long, short) => {
    expect(getTournamentLogo(long)).toBeTruthy();
    expect(getTournamentLogo(long)).toBe(getTournamentLogo(short));
  });

  it("keeps Glenbrook South off Glenbrook North's logo", () => {
    expect(getTournamentLogo("Glenbrook South")).not.toBe(getTournamentLogo("Glenbrook North"));
  });
});
