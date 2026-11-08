/**
 * @fileoverview openCaselist team-page scraper CLI: list every team (and its
 * wiki page) in the PF, LD and policy (HS + NDT/CEDA) caselists, or scrape one
 * team's rounds, open-source `.docx` files and wiki cite text.
 *
 * ```bash
 * export OPENCASELIST_API_KEY=…            # or CASELIST_USERNAME + CASELIST_PASSWORD (Tabroom login)
 * bun run scrape-caselist-teams caselists                     # every open caselist
 * bun run scrape-caselist-teams teams --format=pf             # every PF team page, as JSON lines
 * bun run scrape-caselist-teams teams --caselist=ndtceda25 --out=teams.json
 * bun run scrape-caselist-teams team ndtceda25 Michigan AlBa --files --out=./michigan-alba
 * bun run scrape-caselist-teams find --format=ld --school="Harker" --team="Jane Smith"
 * ```
 *
 * `team --out=DIR` writes `team.json` (team, rounds, cites), `cites.md` (the
 * wiki arguments, grouped by side) and, with `--files`, every open-source
 * document. Downloads are spaced 6.5 s apart because openCaselist allows ten a
 * minute.
 *
 * @module caselist/caselist-teams-cli
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CaselistEvent, CaselistLevel } from "./caselist-config";
import {
  type CaselistClient,
  type CaselistTeamPage,
  caselistRoundLabel,
  caselistSideLabel,
  caselistsForFormat,
  createCaselistClient,
  listCaselistTeams,
  matchCaselistSchool,
  matchCaselistTeam,
  rankedTeamLastNames,
  scrapeTeam,
} from "./caselist-api";

/** Parsed `--key=value` flags plus positional arguments. */
export interface TeamsCliArgs {
  command: string;
  positional: string[];
  flags: Record<string, string | true>;
}

/** Splits argv into a command, positionals and flags. */
export function parseTeamsArgs(argv: string[]): TeamsCliArgs {
  const flags: Record<string, string | true> = {};
  const positional: string[] = [];
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)(?:=(.*))?$/);
    if (match) flags[match[1]] = match[2] ?? true;
    else positional.push(arg);
  }
  return { command: positional.shift() ?? "help", positional, flags };
}

/** `pf`, `ld`, `policy`, `cx`, `ceda`, `ndt`, `ndtceda` → event + level. */
export function parseFormat(value: string | undefined): { event: CaselistEvent; level?: CaselistLevel } | null {
  switch ((value ?? "").toLowerCase()) {
    case "pf":
      return { event: "pf" };
    case "ld":
      return { event: "ld" };
    case "policy":
    case "cx":
      return { event: "policy" };
    case "hspolicy":
      return { event: "policy", level: "hs" };
    case "ceda":
    case "ndt":
    case "ndtceda":
      return { event: "policy", level: "college" };
    default:
      return null;
  }
}

/** Renders a team's wiki cites as markdown, grouped by side then round. */
export function citesMarkdown(page: CaselistTeamPage, event?: string | null): string {
  const lines = [`# ${page.team.display_name} — ${page.caselist}`, ""];
  const sides = new Map<string, typeof page.cites>();
  for (const cite of page.cites) {
    const side = caselistSideLabel(cite.side, event) || "Other";
    sides.set(side, [...(sides.get(side) ?? []), cite]);
  }
  for (const [side, cites] of sides) {
    lines.push(`## ${side}`, "");
    for (const cite of cites) {
      const meta = [cite.tournament, caselistRoundLabel(cite.round), cite.opponent && `vs ${cite.opponent}`]
        .filter(Boolean)
        .join(" | ");
      lines.push(`### ${cite.title ?? "Untitled"}`, meta ? `_${meta}_` : "", "", (cite.cites ?? "").trim(), "");
    }
  }
  return `${lines.join("\n").trim()}\n`;
}

function clientFromEnv(flags: TeamsCliArgs["flags"]): CaselistClient {
  const flag = (name: string) => (typeof flags[name] === "string" ? (flags[name] as string) : undefined);
  return createCaselistClient({
    token: flag("token") ?? process.env.OPENCASELIST_API_KEY,
    username: process.env.CASELIST_USERNAME,
    password: process.env.CASELIST_PASSWORD,
  });
}

async function caselistSlugs(client: CaselistClient, flags: TeamsCliArgs["flags"]): Promise<string[]> {
  if (typeof flags.caselist === "string") return flags.caselist.split(",");
  const format = parseFormat(typeof flags.format === "string" ? flags.format : undefined);
  const all = await client.caselists({ archived: flags.archived === true });
  const chosen = format ? caselistsForFormat(all, format.event, format.level) : all;
  if (flags.archived === true) return chosen.map((caselist) => caselist.name);
  // Without --archived, only the newest season of each format/level.
  const newest = new Map<string, string>();
  for (const caselist of chosen.sort((a, b) => b.year - a.year)) {
    const key = `${caselist.event}/${caselist.level}`;
    if (!newest.has(key)) newest.set(key, caselist.name);
  }
  return [...newest.values()];
}

async function output(text: string, out: string | true | undefined): Promise<void> {
  if (typeof out === "string") {
    await mkdir(path.dirname(path.resolve(out)), { recursive: true });
    await writeFile(out, text);
    console.error(`Wrote ${out}`);
  } else {
    process.stdout.write(text);
  }
}

const USAGE = `Usage: scrape-caselist-teams <command> [options]

  caselists [--archived]                        List caselists
  teams [--format=pf|ld|policy|ceda] [--caselist=slug[,slug]] [--archived] [--out=file.json]
                                                Every team page in those caselists
  team <caselist> <school> <team> [--files] [--out=dir]
                                                One team: rounds, wiki cites, open-source files
  find --format=… --school="Display Name" --team="Last & Last" [--files] [--out=dir]
                                                Resolve a ranked team to its page, then scrape it

Auth: OPENCASELIST_API_KEY (a caselist_token cookie) or CASELIST_USERNAME + CASELIST_PASSWORD (Tabroom).`;

async function writeTeam(page: CaselistTeamPage, event: string | null, out: string | true | undefined) {
  const summary = `${page.team.display_name}: ${page.rounds.length} rounds, ${page.cites.length} cites, ${
    page.rounds.filter((round) => round.opensource).length
  } open-source files`;
  if (typeof out !== "string") {
    const { files, ...rest } = page;
    process.stdout.write(`${JSON.stringify({ ...rest, files: files.map((file) => file.path) }, null, 2)}\n`);
    console.error(summary);
    return;
  }
  await mkdir(out, { recursive: true });
  const { files, ...rest } = page;
  await writeFile(path.join(out, "team.json"), JSON.stringify({ ...rest, files: files.map((f) => f.path) }, null, 2));
  await writeFile(path.join(out, "cites.md"), citesMarkdown(page, event));
  for (const file of files) await writeFile(path.join(out, file.fileName), file.bytes);
  console.error(`${summary} → ${out}`);
  for (const failure of page.fileErrors) console.error(`  ! ${failure.path}: ${failure.error}`);
}

/** Runs one CLI command. */
export async function run(argv: string[]): Promise<void> {
  const { command, positional, flags } = parseTeamsArgs(argv);
  const downloadOptions = {
    downloadFiles: flags.files === true,
    onFile: (file: string, index: number, total: number) => console.error(`  [${index}/${total}] ${file}`),
  };

  switch (command) {
    case "caselists": {
      const client = clientFromEnv(flags);
      const caselists = await client.caselists({ archived: flags.archived === true });
      await output(
        `${caselists.map((c) => `${c.name}\t${c.event}\t${c.level}\t${c.year}\t${c.display_name}`).join("\n")}\n`,
        flags.out,
      );
      return;
    }
    case "teams": {
      const client = clientFromEnv(flags);
      const rows = [];
      for (const slug of await caselistSlugs(client, flags)) {
        console.error(`Listing ${slug}…`);
        rows.push(...(await listCaselistTeams(client, slug)));
      }
      const text =
        typeof flags.out === "string" && flags.out.endsWith(".json")
          ? `${JSON.stringify(rows, null, 2)}\n`
          : `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`;
      await output(text, flags.out);
      console.error(`${rows.length} team pages`);
      return;
    }
    case "team": {
      const [caselist, school, team] = positional;
      if (!caselist || !school || !team) throw new Error(USAGE);
      const client = clientFromEnv(flags);
      const page = await scrapeTeam(client, caselist, school, team, downloadOptions);
      const event = (await client.caselists({ archived: true })).find((c) => c.name === caselist)?.event ?? null;
      await writeTeam(page, event, flags.out);
      return;
    }
    case "find": {
      const school = typeof flags.school === "string" ? flags.school : "";
      const teamName = typeof flags.team === "string" ? flags.team : "";
      if (!school || !teamName) throw new Error(USAGE);
      const client = clientFromEnv(flags);
      for (const slug of await caselistSlugs(client, flags)) {
        const match = matchCaselistSchool(await client.schools(slug), school);
        if (!match) continue;
        const team = matchCaselistTeam(await client.teams(slug, match.name), rankedTeamLastNames(teamName));
        if (!team) continue;
        const page = await scrapeTeam(client, slug, match.name, team.name, downloadOptions);
        page.school = match;
        const event = parseFormat(typeof flags.format === "string" ? flags.format : undefined)?.event ?? null;
        await writeTeam(page, event, flags.out);
        return;
      }
      throw new Error(`No caselist team page found for ${school} ${teamName}`);
    }
    default:
      console.log(USAGE);
  }
}

if (import.meta.main) {
  run(process.argv.slice(2)).catch((error: Error) => {
    console.error(error.message);
    process.exit(1);
  });
}
