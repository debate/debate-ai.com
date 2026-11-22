import { appendFile, readFile, writeFile } from "node:fs/promises";

const CONFIG_PATH = ".zenodo.json";
const PDF_PATH = "paper.pdf";
const METADATA_PATH = ".zenodo-metadata.json";
const MAX_BYTES = 100 * 1024 * 1024;
const TIMEOUT_MS = 120_000;

async function main(): Promise<void> {
  const parsed: unknown = JSON.parse(
    await readFile(CONFIG_PATH, "utf8"),
  );

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed)
  ) {
    throw new Error(`${CONFIG_PATH} must contain a JSON object.`);
  }

  const config = parsed as Record<string, unknown>;
  const { concept_id, pdf_url, ...metadata } = config;

  if (
    typeof concept_id !== "string" &&
    typeof concept_id !== "number"
  ) {
    throw new Error("concept_id must be a string or number.");
  }

  if (
    typeof concept_id === "number" &&
    !Number.isSafeInteger(concept_id)
  ) {
    throw new Error("Numeric concept_id must be a safe integer.");
  }

  const conceptId = String(concept_id).trim();

  if (!/^[1-9]\d*$/.test(conceptId)) {
    throw new Error("concept_id must be a positive integer identifier.");
  }

  if (typeof pdf_url !== "string" || !pdf_url.trim()) {
    throw new Error("pdf_url must be a nonempty HTTPS URL.");
  }

  let url: URL;

  try {
    url = new URL(pdf_url.trim());
  } catch {
    throw new Error("pdf_url is not a valid URL.");
  }

  if (url.protocol !== "https:") {
    throw new Error("pdf_url must use HTTPS.");
  }

  if (url.username || url.password) {
    throw new Error("URLs containing credentials are not supported.");
  }

  if (typeof metadata.title !== "string" || !metadata.title.trim()) {
    throw new Error("Paper title is required.");
  }

  if (
    typeof metadata.description !== "string" ||
    !metadata.description.trim()
  ) {
    throw new Error("Paper description is required.");
  }

  if (
    !Array.isArray(metadata.creators) ||
    metadata.creators.length === 0
  ) {
    throw new Error("At least one creator is required.");
  }

  const githubOutput = process.env.GITHUB_OUTPUT;

  if (!githubOutput) {
    throw new Error("GITHUB_OUTPUT is missing. Run this in GitHub Actions.");
  }

  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      Accept: "application/pdf",
    },
  });

  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`PDF download failed: HTTP ${response.status}.`);
  }

  if (new URL(response.url).protocol !== "https:") {
    await response.body?.cancel();
    throw new Error("The download redirected to a non-HTTPS URL.");
  }

  if (!response.body) {
    throw new Error("The download returned no response body.");
  }

  const contentLength = Number(response.headers.get("content-length"));

  if (Number.isFinite(contentLength) && contentLength > MAX_BYTES) {
    await response.body.cancel();
    throw new Error("The PDF exceeds the 100 MiB download limit.");
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of response.body) {
    const buffer = Buffer.from(chunk);
    totalBytes += buffer.length;

    if (totalBytes > MAX_BYTES) {
      throw new Error("The PDF exceeds the 100 MiB download limit.");
    }

    chunks.push(buffer);
  }

  const pdf = Buffer.concat(chunks, totalBytes);

  if (pdf.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new Error(
      "The downloaded file does not begin with a PDF header. " +
        "Use a direct PDF URL, not a preview or login page.",
    );
  }

  await writeFile(PDF_PATH, pdf);

  await writeFile(
    METADATA_PATH,
    `${JSON.stringify(metadata, null, 2)}\n`,
    "utf8",
  );

  await appendFile(
    githubOutput,
    `concept_id=${conceptId}\n`,
    "utf8",
  );

  console.log(
    `Prepared ${PDF_PATH} (${totalBytes.toLocaleString()} bytes) ` +
      `for Zenodo concept ${conceptId}.`,
  );
}

main().catch((error: unknown) => {
  const message =
    error instanceof TypeError
      ? "Download failed. Check the URL and network accessibility."
      : error instanceof SyntaxError
        ? "The configuration contains invalid JSON."
        : error instanceof Error
          ? error.message
          : "Unknown preparation error.";

  console.error(message);
  process.exitCode = 1;
});