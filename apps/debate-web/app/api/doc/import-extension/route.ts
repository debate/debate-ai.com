import { NextRequest, NextResponse } from "next/server";
import { docxToStoredCmir } from "@debate-ai/reason-docs/lib/topic-starters/import";
import { STORED_FORMATS } from "@debate-ai/reason-docs/lib/debate-editor/format";
import { getSession } from "@/lib/auth/session";
import { getDBFromContext } from "@/lib/database/context";
import { documents } from "@/lib/database/schema";
import { ensureDocumentColumns, fileStatColumns } from "@/lib/file-stats/columns";
import { withRouteErrors } from "@/lib/api/route-errors";

/** `data:` URLs and raw base64 both turn up in the wild; strip any header. */
function base64ToArrayBuffer(input: string): ArrayBuffer {
  const clean = input.replace(/^data:[^;]+;base64,/, "").replace(/\s/g, "");
  if (clean.length === 0) throw new Error("empty file");
  const table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const out = new Uint8Array(Math.floor((clean.length / 4) * 3));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const chunk = clean.slice(i, i + 4);
    const a = table.indexOf(chunk[0] ?? "");
    const b = table.indexOf(chunk[1] ?? "");
    if (a < 0 || b < 0) throw new Error("invalid base64");
    out[o++] = (a << 2) | (b >> 4);
    const c = table.indexOf(chunk[2] ?? "");
    const d = table.indexOf(chunk[3] ?? "");
    if (chunk[2] !== "=" && chunk[2] !== undefined) {
      if (c < 0) throw new Error("invalid base64");
      out[o++] = ((b & 0x0f) << 4) | (c >> 2);
    }
    if (chunk[3] !== "=" && chunk[3] !== undefined) {
      if (d < 0) throw new Error("invalid base64");
      out[o++] = ((c & 0x03) << 6) | d;
    }
  }
  return out.slice(0, o).buffer;
}

/**
 * The Chrome extension's import receiver.
 *
 * The extension downloads a .docx the reader right-clicked (extensions fetch
 * cross-origin without a CORS preflight, which a page cannot do) and POSTs the
 * bytes here as base64. The .docx is converted to Debate Editor's native
 * `.cmir` — the same conversion the admin Topic Starter importer runs
 * server-side — and filed under the signed-in reader's My Files, then the
 * editor is opened on it from the extension.
 */
export const POST = withRouteErrors("POST /api/doc/import-extension", async (req: NextRequest) => {
  const session = await getSession();
  const userId = session?.user?.id ?? null;
  if (!userId) {
    return NextResponse.json(
      { error: "Sign in to your Debate AI account to import a file." },
      { status: 401 },
    );
  }

  const db = await getDBFromContext();
  await ensureDocumentColumns(db);

  let body: { docx?: unknown; filename?: unknown; title?: unknown; parentId?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const docx = typeof body.docx === "string" ? body.docx : undefined;
  const filename = typeof body.filename === "string" ? body.filename : undefined;
  if (!docx || !filename) {
    return NextResponse.json({ error: "A .docx file and its filename are required." }, { status: 400 });
  }

  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = base64ToArrayBuffer(docx);
    if (arrayBuffer.byteLength === 0) throw new Error("empty file");
  } catch {
    return NextResponse.json({ error: "The file could not be decoded." }, { status: 400 });
  }

  let content: string;
  try {
    content = await docxToStoredCmir(arrayBuffer);
  } catch (error) {
    return NextResponse.json(
      {
        error: `The .docx could not be imported: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 422 },
    );
  }

  const title =
    (typeof body.title === "string" && body.title.trim()) ||
    filename.replace(/\.docx$/i, "").trim() ||
    "Untitled";

  const [created] = await db
    .insert(documents)
    .values({
      title: title.slice(0, 200),
      content,
      format: STORED_FORMATS.cmir,
      userId,
      parentId: typeof body.parentId === "number" ? body.parentId : null,
      isFolder: false,
      author: session?.user?.name || null,
      ...(await fileStatColumns(content, STORED_FORMATS.cmir)),
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
});
