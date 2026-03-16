import { NextResponse } from "next/server"
import dictionary from "@/lib/debate-data/debate-metadata/debate-dictionary.json"

export async function GET() {
  return NextResponse.json(dictionary.data)
}
