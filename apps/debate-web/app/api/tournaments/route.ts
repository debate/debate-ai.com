import { NextResponse } from "next/server";
import tournaments from "@debate-ai/rankings/data/debate-tournaments.json";

export async function GET() {
    return NextResponse.json({
        tournaments: tournaments.data,
        total: tournaments.data.length,
    });
}
