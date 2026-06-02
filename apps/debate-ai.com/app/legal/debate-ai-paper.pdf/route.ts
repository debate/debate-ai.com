import { NextResponse } from "next/server";

// Google Drive direct-download URL.
// Using the /uc?export=download&confirm=t link avoids the interstitial
// for large files; the browser still gets the raw PDF bytes.
const DRIVE_FILE_ID = "17y5cK9rZdAnYGcaiAd8da1FYJCUgcGIo";
const PDF_URL = `https://drive.google.com/uc?export=download&confirm=t&id=${DRIVE_FILE_ID}`;

export async function GET() {
  const upstream = await fetch(PDF_URL, {
    // Follow redirects so we end up with the real PDF bytes
    redirect: "follow",
  });

  if (!upstream.ok) {
    return new NextResponse("Failed to fetch PDF", { status: 502 });
  }

  const pdfBytes = await upstream.arrayBuffer();

  return new NextResponse(pdfBytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      // "inline" tells the browser to display the PDF instead of downloading it
      "Content-Disposition": 'inline; filename="debate-ai-paper.pdf"',
      "Content-Length": String(pdfBytes.byteLength),
      // Cache for 1 hour — the paper is static
    },
  });
}
