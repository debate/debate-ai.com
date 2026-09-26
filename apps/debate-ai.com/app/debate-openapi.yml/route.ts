import { NextResponse } from "next/server";
// The spec lives in debate-api-client (its SDK is generated from it); the
// /api Scalar reference loads it from this URL.
import spec from "debate-api-client/debate-openapi.yml?raw";

export async function GET() {
  return new NextResponse(spec, {
    headers: { "Content-Type": "application/yaml; charset=utf-8" },
  });
}
