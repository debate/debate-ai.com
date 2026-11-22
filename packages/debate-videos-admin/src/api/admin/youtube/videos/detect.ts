import { NextRequest, NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { getStaffAccess } from "@/lib/auth/admin";
import { getDBFromContext } from "@/lib/database/context";
import { ensureRoundVideosTable } from "@/lib/youtube/round-videos-table";
import { youtubeRoundVideos } from "@/lib/database/schema";
import {
  askModel,
  autofillKeys,
  buildAutofillContent,
} from "@/lib/videos/video-autofill";
import { LECTURE_CATEGORIES } from "@debate-ai/videos/src/data/lecture-classifier";
import type { ProviderKey } from "@/lib/ai/provider-key";

type DB = Awaited<ReturnType<typeof getDBFromContext>>;

/** The queue-row fields detect reads: the text the model sees, plus the stored style/category. */
type QueueVideo = Pick<typeof youtubeRoundVideos.$inferSelect, "id" | "title" | "channel" | "description" | "style" | "category">;

/**
 * One prompt — the "custom script" — sent to OpenRouter's free router
 * (`openrouter/free`) for every video the admin asks to be auto-detected. It
 * classifies each video as a debate round (and which format) or as a lecture
 * (and which lecture category), and the same script is reused for every video
 * on the page.
 */
const DETECT_PROMPT = `You catalogue YouTube videos for a competitive debate video library (Policy, Public Forum, Lincoln-Douglas, college debate).

Given a video's title, channel and description, say what kind of video it is. Answer with a single JSON object and nothing else — no prose, no code fence — with exactly these keys:
{"style": "", "category": ""}

style: "policy", "pf" (Public Forum), "ld" (Lincoln-Douglas), "college" (NDT/CEDA/college policy), "wsd" (World Schools), "acc" (the ACC Debate Tournament), "parli" (parliamentary debate: NPDA, NPTE, APDA, high-school parli), "congress" (congressional debate), "misc" (any other debate round format) when the video is a recorded debate round. "lecture" for anything else — lectures, drills, demo explanations, documentaries, advice.
category: for a lecture, the single best category from the allowed list. For a round, "none".

Allowed values: style is one of "policy", "pf", "ld", "college", "wsd", "acc", "parli", "congress", "misc", "lecture". category is "none" or one of: ${LECTURE_CATEGORIES.map((c) => `"${c}"`).join(", ")}.

Use only what the text says. Leave a field empty rather than guess.`;

/**
 * Most videos one request detects. Each can wait up to DETECT_TIMEOUT_MS per
 * key, so the queue page's "Detect all" sends the page in batches of this size
 * instead of one request that would outlive the Worker.
 */
const MAX_DETECT_IDS = 5;

/** How long one video's model call gets before the detect moves on to the next. */
const DETECT_TIMEOUT_MS = 20_000;

/**
 * Detects one video: asks the model, then writes style/category back to its
 * queue row. A field the model left empty keeps the row's stored value, so an
 * unsure answer never turns a round into a lecture.
 */
async function detectOne(db: DB, keys: ProviderKey[], video: QueueVideo): Promise<{ style: number | null; category: string | null }> {
  const content = buildAutofillContent({ title: video.title, channel: video.channel, description: video.description });
  const fields = await askModel(content, keys, DETECT_TIMEOUT_MS, DETECT_PROMPT);
  if (fields.style === undefined) {
    throw new Error("The model couldn't tell what kind of video this is; left it unchanged.");
  }
  const style = fields.style;
  const category = style === null ? (fields.category ?? video.category ?? null) : null;
  await db
    .update(youtubeRoundVideos)
    .set({ style, category, updatedAt: new Date() })
    .where(eq(youtubeRoundVideos.id, video.id));
  return { style, category };
}

interface DetectedVideo { id: string; style: number | null; category: string | null; }

export async function POST(req: NextRequest) {
  const { canEditContent } = await getStaffAccess();
  if (!canEditContent) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((id: unknown) => typeof id === "string") : [];
  if (ids.length === 0) {
    return NextResponse.json({ ok: true, results: [], errors: [] });
  }
  if (ids.length > MAX_DETECT_IDS) {
    return NextResponse.json({ error: `Send at most ${MAX_DETECT_IDS} videos per request.` }, { status: 400 });
  }

  const db = await getDBFromContext();
  await ensureRoundVideosTable(db);
  const rows: QueueVideo[] = await db
    .select({ id: youtubeRoundVideos.id, title: youtubeRoundVideos.title, channel: youtubeRoundVideos.channel, description: youtubeRoundVideos.description, style: youtubeRoundVideos.style, category: youtubeRoundVideos.category })
    .from(youtubeRoundVideos)
    .where(inArray(youtubeRoundVideos.id, ids));
  const byId = new Map(rows.map((row) => [row.id, row]));

  const keys = autofillKeys(req);
  const results: DetectedVideo[] = [];
  const errors: Array<{ id: string; error: string }> = [];

  for (const id of ids) {
    const video = byId.get(id);
    if (!video) {
      errors.push({ id, error: "Video not in the queue" });
      continue;
    }
    try {
      const detected = await detectOne(db, keys, video);
      results.push({ id, ...detected });
    } catch (error) {
      errors.push({ id, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return NextResponse.json({ ok: true, results, errors });
}
