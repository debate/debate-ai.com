import { NextResponse } from "next/server";
import tournaments from "@/packages/debate-data-sync/data/metadata/debate-tournaments.json";

export async function GET() {
    return NextResponse.json({
        tournaments: tournaments.data,
        total: tournaments.data.length,
    });
}
