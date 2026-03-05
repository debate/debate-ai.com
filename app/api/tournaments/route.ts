import { type NextRequest, NextResponse } from "next/server";
import Fuse from "fuse.js";
import tournaments from "@/lib/debate-data/debate-tournaments.json";

let fuseCache: Fuse<string> | null = null;

function getFuse(): Fuse<string> {
    if (!fuseCache) {
        fuseCache = new Fuse(tournaments, {
            threshold: 0.4,
            includeScore: true,
            minMatchCharLength: 1,
        });
    }
    return fuseCache;
}

export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const q = (searchParams.get("q") ?? "").trim();
    const limit = Math.min(
        Number.parseInt(searchParams.get("limit") ?? "20", 10),
        100,
    );

    let results: string[];

    if (!q) {
        // No query – return the first `limit` entries
        results = tournaments.slice(0, limit);
    } else {
        const fuse = getFuse();
        results = fuse
            .search(q, { limit })
            .map((r) => r.item);
    }

    return NextResponse.json({ results, total: results.length });
}
