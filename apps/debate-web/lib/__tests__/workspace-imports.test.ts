import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import * as workspaceLinks from "../../../../.github/scripts/workspace-links.mjs";

const { exportCandidates, findMissingWorkspaceLinks, findUnresolvableImports } = workspaceLinks as {
  exportCandidates: (exportsField: unknown, subpath: string, manifest?: object) => string[] | null;
  findMissingWorkspaceLinks: (root: string) => { workspace: string; dependency: string }[];
  findUnresolvableImports: (root: string) => { file: string; specifier: string; reason: string }[];
};

const repoRoot = path.resolve(import.meta.dirname, "../../../..");
const format = (problems: { file: string; specifier: string; reason: string }[]) =>
  problems.map(({ file, specifier, reason }) => `${file} imports ${specifier}: ${reason}`).join("\n");

describe("@debate-ai/* workspace imports", () => {
  it("every @debate-ai/* subpath imported in the repo is declared, exported and present on disk", () => {
    // Regression: help-docs imported `@debate-ai/videos/page-flow-chart` and the build failed with
    // "Rolldown failed to resolve import" whenever that did not line up.
    expect(format(findUnresolvableImports(repoRoot))).toBe("");
  });

  it("resolves the docs toolbar's flow chart entry through @debate-ai/videos", () => {
    const videos = JSON.parse(
      readFileSync(path.join(repoRoot, "packages/debate-videos/package.json"), "utf8"),
    );
    const help = JSON.parse(
      readFileSync(path.join(repoRoot, "packages/debate-help-docs/package.json"), "utf8"),
    );
    expect(help.dependencies["@debate-ai/videos"]).toBe("workspace:*");
    expect(exportCandidates(videos.exports, "./page-flow-chart")).toContain("./src/page-flow-chart.ts");
  });

  it("every workspace:* dependency is linked into node_modules (run `bun install` if this fails)", () => {
    expect(findMissingWorkspaceLinks(repoRoot)).toEqual([]);
  });
});

describe("workspace import checker", () => {
  let tmp = "";
  const created: string[] = [];
  afterEach(() => created.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

  const writeFile = (file: string, contents: string) => {
    mkdirSync(path.dirname(path.join(tmp, file)), { recursive: true });
    writeFileSync(path.join(tmp, file), contents);
  };
  const manifest = (file: string, json: object) => writeFile(file, JSON.stringify(json));

  const fixture = (consumerDeps: Record<string, string>, producerExports: Record<string, unknown>) => {
    tmp = mkdtempSync(path.join(tmpdir(), "workspace-imports-"));
    created.push(tmp);
    manifest("packages/lib/package.json", { name: "@debate-ai/lib", exports: producerExports });
    writeFile("packages/lib/src/present.ts", "export {};");
    manifest("packages/app/package.json", { name: "@debate-ai/app", dependencies: consumerDeps });
    writeFile("packages/app/src/page.tsx", `import { x } from "@debate-ai/lib/present";\nimport("@debate-ai/lib/missing");\n`);
    return tmp;
  };

  it("flags a missing file, a missing exports entry and an undeclared dependency", () => {
    const root = fixture({ "@debate-ai/lib": "workspace:*" }, { "./*": "./src/*" });
    expect(findUnresolvableImports(root).map((p) => p.specifier)).toEqual(["@debate-ai/lib/missing"]);

    const noEntry = fixture({ "@debate-ai/lib": "workspace:*" }, { ".": "./src/present.ts" });
    expect(findUnresolvableImports(noEntry).map((p) => p.reason)).toEqual([
      expect.stringContaining('no "exports" entry for ./present'),
      expect.stringContaining('no "exports" entry for ./missing'),
    ]);

    const undeclared = fixture({}, { "./*": "./src/*" });
    expect(findUnresolvableImports(undeclared).map((p) => p.reason)).toEqual(
      expect.arrayContaining([expect.stringContaining("does not declare @debate-ai/lib")]),
    );
  });

  it("flags a workspace:* dependency with no node_modules link", () => {
    const root = fixture({ "@debate-ai/lib": "workspace:*" }, { "./*": "./src/*" });
    expect(findMissingWorkspaceLinks(root)).toEqual([{ workspace: "packages/app", dependency: "@debate-ai/lib" }]);
    mkdirSync(path.join(root, "packages/app/node_modules/@debate-ai/lib"), { recursive: true });
    expect(findMissingWorkspaceLinks(root)).toEqual([]);
  });

  it("expands wildcards, array fallbacks and extensionless targets", () => {
    expect(exportCandidates({ "./*": ["./src/*", "./src/*.ts"] }, "./a/b")).toEqual(
      expect.arrayContaining(["./src/a/b", "./src/a/b.ts", "./src/a/b.tsx", "./src/a/b/index.ts"]),
    );
    expect(exportCandidates({ ".": "./src/index.ts" }, "./nope")).toBeNull();
  });
});
