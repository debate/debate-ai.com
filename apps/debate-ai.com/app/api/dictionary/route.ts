import { NextResponse } from "next/server"
import dictionary from "debate-data-sync/data/metadata/debate-dictionary.json"

export async function GET() {
  return NextResponse.json(dictionary.data)
}
