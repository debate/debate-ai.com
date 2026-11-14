import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The root `dev:web` / `build:web` shortcuts filter turbo to this app by its
 * package name. When the app was renamed, the filter kept the old name and
 * `bun run build:web` failed with "No package found" before building anything.
 * These checks keep the shortcuts pointed at the app's real package name.
 */
const repoRoot = path.resolve(import.meta.dirname, "../../../..");

type PackageJson = { name?: string; scripts?: Record<string, string> };

function readPackageJson(relativePath: string): PackageJson {
  return JSON.parse(readFileSync(path.join(repoRoot, relativePath), "utf8")) as PackageJson;
}

/** The `--filter=` values of a turbo command, without surrounding quotes. */
function turboFilters(command: string): string[] {
  return [...command.matchAll(/--filter[= ](['"]?)([^\s'"]+)\1/g)].map((match) => match[2]);
}

const rootScripts = readPackageJson("package.json").scripts ?? {};
const webPackageName = readPackageJson("apps/debate-web/package.json").name;

describe("turboFilters", () => {
  it("reads plain, quoted and space-separated filters", () => {
    expect(turboFilters("turbo build --filter=@a/b")).toEqual(["@a/b"]);
    expect(turboFilters("turbo build --filter='!@a/b' --filter=\"c\"")).toEqual(["!@a/b", "c"]);
    expect(turboFilters("turbo dev --filter x")).toEqual(["x"]);
  });

  it("returns nothing for a command without filters", () => {
    expect(turboFilters("turbo typecheck")).toEqual([]);
  });
});

describe("root web shortcuts", () => {
  it("knows the web app's package name", () => {
    expect(webPackageName).toBe("@debate-ai/web");
  });

  it.each(["dev:web", "build:web"])("%s filters to the web app package", (script) => {
    const command = rootScripts[script];
    expect(command, `root package.json has no "${script}" script`).toBeDefined();
    expect(turboFilters(command)).toEqual([webPackageName]);
  });
});
