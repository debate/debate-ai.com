import { NextResponse, type NextRequest } from "next/server";
import { EXTINCTION_BASE_URL, EXTINCTION_FORMAT_PREFIX, currentRankingSeasonYear } from "@debate-ai/rankings";
import { getDBFromContext } from "@/lib/database/context";
import { readSavedExtinctionFile, saveExtinctionFile } from "@/lib/rankings/extinction-store";

type ExtinctionKind = "teams" | "bids";

function parseFileName(file: string): { format: keyof typeof EXTINCTION_FORMAT_PREFIX; seasonYear: number } | null {
  const match = /^([A-Za-z]+)(\d{2})(\d{2})\.json$/.exec(file);
  if (!match) return null;
  const [, prefix, startStr, endStr] = match;
  const format = Object.entries(EXTINCTION_FORMAT_PREFIX).find(([, p]) => p === prefix)?.[0] as keyof typeof EXTINCTION_FORMAT_PREFIX | undefined;
  if (!format) return null;
  const startYear = 2000 + Number(startStr);
  const endYear = 2000 + Number(endStr);
  if (endYear !== startYear + 1) return null;
  return { format, seasonYear: endYear };
}

function isPastSeason(seasonYear: number): boolean {
  return seasonYear < currentRankingSeasonYear();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ kind: string; file: string }> }
) {
  const { kind, file } = await params;

  if (kind !== "teams" && kind !== "bids") {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }

  const parsed = parseFileName(file);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid file name" }, { status: 400 });
  }

  const { format, seasonYear } = parsed;
  const past = isPastSeason(seasonYear);

  if (past) {
    try {
      const db = await getDBFromContext();
      const saved = await readSavedExtinctionFile(db, kind, file);
      if (saved) {
        if (saved.status === 200) {
          return new Response(saved.body, {
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "public, max-age=31536000, immutable",
            },
          });
        }
        return new Response(null, { status: saved.status, statusText: saved.status === 403 ? "Forbidden" : "Not Found" });
      }
    } catch {
    }
  }

  try {
    const res = await fetch(`${EXTINCTION_BASE_URL}/${kind}/${file}`, {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      if (past) {
        try {
          const db = await getDBFromContext();
          await saveExtinctionFile(db, kind, file, { status: res.status, body: "" }).catch(() => undefined);
        } catch {
        }
      }
      return new Response(null, { status: res.status, statusText: res.statusText });
    }

    const body = await res.text();

    if (past) {
      try {
        const db = await getDBFromContext();
        await saveExtinctionFile(db, kind, file, { status: 200, body }).catch(() => undefined);
      } catch {
      }
    }

    return new Response(body, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": past ? "public, max-age=31536000, immutable" : "public, max-age=300, s-maxage=300",
      },
    });
  } catch (error) {
    console.error("[extinction] proxy error", kind, file, error);
    return NextResponse.json({ error: "Extinction.GG unavailable" }, { status: 502 });
  }
}