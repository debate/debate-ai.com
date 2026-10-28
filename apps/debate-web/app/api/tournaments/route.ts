import { NextResponse } from "next/server";
import tournaments from "@debate-ai/rankings-adapter/data/debate-tournaments.json";

export async function GET() {
    return NextResponse.json({
        tournaments: tournaments.data,
        total: tournaments.data.length,
    });
}
