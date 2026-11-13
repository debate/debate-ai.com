/**
 * @fileoverview Admin-only openCaselist → Topic Starters sync.
 *
 * `POST` discovers a caselist's newest bulk archive, streams it into R2 and
 * returns a queued job id; the conversion to `.cmir` runs in the background
 * (see `lib/topic-starters/sync.ts`). `GET ?jobId=` reports a job's progress,
 * and `GET` with no id lists the newest jobs so the panel can show the last
 * run after a reload.
 *
 * @module app/api/admin/topic-starters/sync/route
 */
import { NextRequest, NextResponse } from "next/server";
import { getRequestExecutionContext } from "vinext/shims/request-context";
import { getAdminAccess } from "@/lib/auth/admin";
import {
  getTopicStarterImport,
  listTopicStarterImports,
  processTopicStarterImport,
  startTopicStarterSync,
  TopicStarterSyncError,
} from "@/lib/topic-starters/sync";

/** A job row as the panel reads it: dates and failures already serialized. */
function shapeJob(job: Awaited<ReturnType<typeof getTopicStarterImport>>) {
  if (!job) return null;
  return {
    id: job.id,
    caselistSlug: job.caselistSlug,
    caselistLabel: job.caselistLabel,
    archiveFileName: job.archiveFileName,
    topicCode: job.topicCode,
    year: job.year,
    published: job.published,
    status: job.status,
    found: job.found,
    imported: job.imported,
    failed: job.failed,
    failures: JSON.parse(job.failures || "[]") as unknown[],
    error: job.error,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
  };
}

export async function GET(request: NextRequest) {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const jobId = request.nextUrl.searchParams.get("jobId");
  if (jobId) {
    const job = await getTopicStarterImport(jobId);
    if (!job) return NextResponse.json({ error: "That sync is not known." }, { status: 404 });
    return NextResponse.json({ job: shapeJob(job) });
  }

  const jobs = await listTopicStarterImports();
  return NextResponse.json({ jobs: jobs.map((job) => shapeJob(job)) });
}

export async function POST(request: NextRequest) {
  const { isAdmin, email } = await getAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    const parsed = (await request.json()) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Send a JSON body.", code: "bad-request" }, { status: 400 });
  }

  const caselist = typeof body.caselist === "string" ? body.caselist.trim() : "";
  if (!caselist) return NextResponse.json({ error: "Pick a caselist to sync.", code: "no-caselist" }, { status: 400 });

  try {
    const job = await startTopicStarterSync({
      caselist,
      topicCode: typeof body.topicCode === "string" ? body.topicCode : null,
      published: body.published !== false,
      requestedBy: email ?? null,
    });

    // The ZIP is in R2 and the job row exists; conversion is background work.
    // On Workers the request's ExecutionContext keeps it alive after the
    // response; elsewhere (tests, `next dev`) it runs detached.
    const run = processTopicStarterImport(job.id).catch((error) => {
      console.error("[topic-starters] background sync failed", error);
    });
    const context = getRequestExecutionContext();
    if (context?.waitUntil) context.waitUntil(run);
    else void run;

    return NextResponse.json({ job: shapeJob(job) }, { status: 202 });
  } catch (error) {
    if (error instanceof TopicStarterSyncError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error("[topic-starters] sync failed", error);
    return NextResponse.json({ error: message, code: "sync-failed" }, { status: 500 });
  }
}