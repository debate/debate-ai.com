import { NextResponse } from "next/server"
import dictionary from "@debate/data-sync/data/debate-dictionary.json"

export async function GET() {
  return NextResponse.json(dictionary.data)
}
