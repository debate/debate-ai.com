import { NextResponse } from "next/server"
import dictionary from "@/packages/debate-data-sync/data/metadata/debate-dictionary.json"

export async function GET() {
  return NextResponse.json(dictionary.data)
}
