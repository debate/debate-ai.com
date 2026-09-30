import { NextResponse } from "next/server";

// The bundled human-names dataset (debate-card-parser's human-names-92k.json)
// was removed, so there is no name list to serve. Clients treat an empty list
// as "no suggestions" and keep working.
const ALL_NAMES: string[] = [];

export async function GET() {
  return NextResponse.json({ names: ALL_NAMES });
}
