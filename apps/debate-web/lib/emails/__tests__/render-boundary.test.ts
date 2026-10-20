import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderEmailPreview } from "../ssr-entry";

const appDir = path.resolve(import.meta.dirname, "../../..");
const SSR_ENTRY = path.join(appDir, "lib/emails/ssr-entry.ts");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.tsx?$/.test(file) && !file.includes("__tests__") && !file.includes("node_modules"))
    .map((file) => path.join(dir, file));
}

/** Names that render, as opposed to the templates' metadata and types. */
const RENDER_IMPORT = /import\s*{[^}]*\brender(?:Email|EmailPreview)?\b[^}]*}\s*from\s*["']@debate\/emails["']/;

describe("email rendering boundary", () => {
  // Route handlers run in the Worker's rsc environment, where react-dom/server
  // is the react-server stub that throws, so rendering there 500'd every
  // admin preview. Rendering has to go through lib/emails/render.ts, which
  // loads ssr-entry.ts into the ssr environment.
  it("never renders @debate/emails directly from routes or server libraries", () => {
    const offenders = [...sourceFiles(path.join(appDir, "app")), ...sourceFiles(path.join(appDir, "lib"))]
      .filter((file) => file !== SSR_ENTRY)
      .filter((file) => RENDER_IMPORT.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(appDir, file));
    expect(offenders).toEqual([]);
  });

  it("renders through the ssr entry", async () => {
    const email = await renderEmailPreview("welcome", "https://d.ebate.app");
    expect(email.subject).toBe("Welcome to Debate AI");
    expect(email.html).toContain("https://d.ebate.app/logo.png");
  });
});
