import { NextResponse } from "next/server";
import tournaments from "@/lib/debate-data/debate-tournaments.json";

export async function GET() {
    return NextResponse.json({
        tournaments,
        total: tournaments.length,
    });
}
