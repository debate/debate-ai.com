/**
 * @fileoverview CLI for the openCaselist sync: refresh the archive manifest,
 * and optionally download and unpack whatever is new.
 *
 * Run from the repo root:
 *
 * ```bash
 * bun run sync-caselist                          # refresh every caselist's manifest
 * bun run sync-caselist -- --caselist=hsld26     # just one
 * bun run sync-caselist -- --ingest --limit=25   # also unpack, 25 documents in
 * bun run sync-caselist -- --caselist=hsld26 --html-file=page.html
 * bun run sync-caselist -- --ingest --sql-output  # write SQL seed file
 * bun run sync-caselist -- --ingest --apply-local # apply to local SQLite
 * ```
 *
 * `--html-file` is the escape hatch for the page being client-rendered: save
 * the rendered DOM out of a browser and the sync reads the archives straight
 * out of it, with no discovery request at all.
 *
 * The manifest doubles as the sync state: each caselist records the archive
 * URLs already ingested, so an `--ingest` run only fetches the weeks added
 * since the last one.
 *
 * @module caselist/caselist-sync-cli
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { caselistsForSeason, type Caselist } from "./caselist-config";
import { loadCaselistArchive } from "./caselist-archive";
import {
  type CaselistDownloadsResult,
  type CaselistSyncState,
  downloadArchive,
  fetchCaselistDownloads,
  markSynced,
  selectPendingArchives,
} from "./caselist-sync";
import { listArchives } from "./downloads-page-parser";
import {
  buildCaselistDocumentSeedStatements,
  caselistDocumentSeedValues,
} from "./caselist-document-sql";

/** Where the manifest is written, relative to the package root. */
const DEFAULT_MANIFEST = "data/metadata/caselist-downloads.json";

/** Where the SQL seed file is written, relative to the package root. */
const DEFAULT_SQL_OUTPUT = "drizzle/seed/caselist-documents-seed.sql";

/** One caselist's entry in the manifest file. */
interface ManifestEntry {
  slug: string;
  label: string;
  pageUrl: string;
  source: string;
  fetchedAt: string;
  all: CaselistDownloadsResult["all"];
  weekly: CaselistDownloadsResult["weekly"];
  /** Archive URLs already ingested by an `--ingest` run. */
  synced: string[];
  /** Ingest counts from the last run that unpacked anything. */
  lastIngest?: {
    at: string;
    archives: number;
    documents: number;
    failures: number;
  };
}

/** The manifest file as a whole. */
interface Manifest {
  $schema?: string;
  updatedAt: string;
  caselists: Record<string, ManifestEntry>;
}

/** Parsed command line. */
interface Options {
  slugs: string[];
  manifestPath: string;
  /** Rendered downloads-page markup to read instead of discovering. */
  htmlFile?: string;
  ingest: boolean;
  limit?: number;
  cards: boolean;
  probe: boolean;
  dryRun: boolean;
  /** Write SQL seed file for caselist documents. */
  sqlOutput?: string;
  /** Apply SQL to local SQLite database. */
  applyLocal: boolean;
}

/**
 * Parses the command line.
 *
 * @param argv - Arguments after the script name.
 * @returns The run's options, with catalog defaults filled in.
 */
export function parseArgs(argv: readonly string[]): Options {
  const value = (flag: string): string | undefined => {
    const hit = argv.find((arg) => arg === flag || arg.startsWith(`${flag}=`));
    if (!hit) return undefined;
    if (hit.includes("=")) return hit.slice(hit.indexOf("=") + 1);
    return argv[argv.indexOf(hit) + 1];
  };
  const has = (flag: string) => argv.includes(flag);

  const requested = value("--caselist");
  const limit = value("--limit");
  const htmlFile = value("--html-file");
  const sqlOutput = value("--sql-output");

  return {
    slugs: requested
      ? requested.split(",").map((slug) => slug.trim()).filter(Boolean)
      : caselistsForSeason().map((caselist) => caselist.slug),
    manifestPath: value("--out") ?? DEFAULT_MANIFEST,
    htmlFile,
    ingest: has("--ingest"),
    limit: limit ? Number.parseInt(limit, 10) : undefined,
    cards: has("--cards"),
    probe: !has("--no-probe"),
    dryRun: has("--dry-run"),
    sqlOutput: sqlOutput ?? (has("--sql-output") ? DEFAULT_SQL_OUTPUT : undefined),
    applyLocal: has("--apply-local"),
  };
}

/**
 * Reads the existing manifest, if there is one.
 *
 * @param file - Absolute path to the manifest.
 * @returns The manifest, or an empty one when the file is missing or unreadable.
 */
async function readManifest(file: string): Promise<Manifest> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as Manifest;
  } catch {
    return { updatedAt: new Date().toISOString(), caselists: {} };
  }
}

/**
 * Applies the statements to the local SQLite file used in development.
 *
 * @param statements - Statements from `buildCaselistDocumentSeedStatements`.
 * @param appDir - The app directory (for finding the local SQLite file).
 */
async function applyLocally(statements: string[], appDir: string) {
  const { createClient } = await import("@libsql/client");
  const client = createClient({
    url: process.env.DATABASE_URL || `file:${path.join(appDir, "data", "db.sqlite")}`,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });

  for (const statement of statements) {
    await client.execute(statement);
  }
  client.close();
}

/**
 * Runs the sync.
 *
 * @param argv - Arguments after the script name.
 * @returns The manifest that was written (or would have been, under `--dry-run`).
 */
export async function run(argv: readonly string[] = []): Promise<Manifest> {
  const options = parseArgs(argv);
  const packageRoot = path.resolve(import.meta.dirname, "../..");
  const manifestFile = path.isAbsolute(options.manifestPath)
    ? options.manifestPath
    : path.join(packageRoot, options.manifestPath);
  const sqlOutputFile = options.sqlOutput
    ? path.isAbsolute(options.sqlOutput)
      ? options.sqlOutput
      : path.join(packageRoot, options.sqlOutput)
    : undefined;

  const manifest = await readManifest(manifestFile);
  manifest.$schema ??= "../../schemas/caselist-downloads.schema.json";

  // Markup is per caselist, so supplying it alongside several would credit one
  // caselist's archives to all of them.
  if (options.htmlFile && options.slugs.length !== 1) {
    throw new Error("--html-file applies to one caselist; pass --caselist=<slug> too.");
  }
  const html = options.htmlFile
    ? await fs.readFile(path.resolve(options.htmlFile), "utf8")
    : undefined;

  const allDocumentStatements: string[] = [];

  for (const slug of options.slugs) {
    const result = await fetchCaselistDownloads(slug, { probe: options.probe, html });
    const previous = manifest.caselists[result.slug];
    const state: CaselistSyncState = { synced: previous?.synced ?? [] };

    const entry: ManifestEntry = {
      slug: result.slug,
      label: result.label,
      pageUrl: result.pageUrl,
      source: result.source,
      fetchedAt: result.fetchedAt,
      all: result.all,
      weekly: result.weekly,
      synced: state.synced,
      lastIngest: previous?.lastIngest,
    };

    console.log(
      `${result.label} — ${listArchives(result).length} archive(s) via ${result.source}`,
    );
    for (const note of result.notes) console.log(`   · ${note}`);

    const pending = selectPendingArchives(result, state);
    if (pending.length === 0) console.log("   nothing new to ingest");
    else console.log(`   ${pending.length} archive(s) not yet ingested`);

    if (options.ingest && !options.dryRun) {
      let documents = 0;
      let failures = 0;
      const ingested = [];
      const caselist = caselistsForSeason().find((c) => c.slug === result.slug);
      if (!caselist) {
        console.log(`   ! Unknown caselist slug: ${result.slug}`);
        continue;
      }

      for (const archive of pending) {
        try {
          console.log(`   downloading ${archive.fileName}…`);
          const { bytes } = await downloadArchive(archive);
          const load = await loadCaselistArchive(bytes, {
            slug: result.slug,
            limit: options.limit,
            parseCards: options.cards,
          });
          documents += load.importedCount;
          failures += load.failures.length;
          ingested.push(archive);
          console.log(
            `   ${archive.fileName}: ${load.importedCount}/${load.entryCount} document(s), ${load.failures.length} failed`,
          );
          for (const failure of load.failures.slice(0, 5)) {
            console.log(`      ! ${failure.path}: ${failure.reason}`);
          }

          // Generate SQL for the documents from this archive
          if (load.documents.length > 0 && (sqlOutputFile || options.applyLocal)) {
            // Extract archive date from filename (e.g., "hspolicy26-all-2026-01-06.zip" -> "2026-01-06")
            const dateMatch = archive.fileName.match(/(\d{4}-\d{2}-\d{2})/);
            const archiveDate = dateMatch ? dateMatch[1] : undefined;
            const seededAt = Math.floor(Date.now() / 1000);
            const docStatements = buildCaselistDocumentSeedStatements(
              load.documents,
              caselist,
              archiveDate,
              seededAt,
            );
            allDocumentStatements.push(...docStatements);
          }
        } catch (error) {
          // A failed archive is skipped, not recorded as synced, so the next
          // run retries exactly it rather than the whole caselist.
          console.log(`   ! ${archive.fileName}: ${(error as Error).message}`);
        }
      }
      const next = markSynced(state, ingested);
      entry.synced = next.synced;
      if (ingested.length > 0) {
        entry.lastIngest = {
          at: next.updatedAt ?? new Date().toISOString(),
          archives: ingested.length,
          documents,
          failures,
        };
      }
    }

    manifest.caselists[result.slug] = entry;
  }

  manifest.updatedAt = new Date().toISOString();

  if (options.dryRun) {
    console.log("--dry-run: manifest not written");
    return manifest;
  }

  await fs.mkdir(path.dirname(manifestFile), { recursive: true });
  await fs.writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Wrote ${manifestFile}`);

  // Write SQL seed file if requested
  if (sqlOutputFile && allDocumentStatements.length > 0) {
    await fs.mkdir(path.dirname(sqlOutputFile), { recursive: true });
    const sql = `${allDocumentStatements.join(";\n\n")};\n`;
    await fs.writeFile(sqlOutputFile, sql, "utf-8");
    console.log(
      `caselist-documents: wrote ${allDocumentStatements.length} statements to ${sqlOutputFile} (${(sql.length / 1024 / 1024).toFixed(2)} MB)`,
    );
  }

  // Apply to local database if requested
  if (options.applyLocal && allDocumentStatements.length > 0) {
    try {
      await applyLocally(allDocumentStatements, packageRoot);
      console.log("caselist-documents: applied to the local SQLite database");
    } catch (error) {
      console.error("caselist-documents: local apply failed (the SQL file is still written)", error);
      process.exitCode = 1;
    }
  }

  return manifest;
}

if (import.meta.main) {
  run(process.argv.slice(2)).catch((error: Error) => {
    console.error(error.message);
    process.exit(1);
  });
}
