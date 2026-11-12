import { readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as stub from "../stubs/kysely-adapter";

// vite.config.ts aliases @better-auth/kysely-adapter to lib/stubs/kysely-adapter.ts,
// so every name better-auth imports from it must exist there or
// `bun run build:web` fails with MISSING_EXPORT. This catches a better-auth
// upgrade that adds a new import before the build does.

const appDir = path.resolve(import.meta.dirname, "../..");
const betterAuthDist = path.dirname(
  createRequire(path.join(appDir, "package.json")).resolve("better-auth"),
);

function listModules(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return listModules(full);
    return name.endsWith(".mjs") ? [full] : [];
  });
}

/** Named value imports of `@better-auth/kysely-adapter` in one module's source. */
function namedKyselyAdapterImports(source: string): string[] {
  const pattern = /import\s*\{([^}]*)\}\s*from\s*["']@better-auth\/kysely-adapter["']/g;
  const names: string[] = [];
  for (const match of source.matchAll(pattern)) {
    for (const part of match[1].split(",")) {
      const spec = part.trim();
      if (!spec || spec.startsWith("type ")) continue;
      names.push(spec.split(/\s+as\s+/)[0].trim());
    }
  }
  return names;
}

describe("kysely-adapter stub", () => {
  it("parses named, aliased and type-only imports", () => {
    expect(
      namedKyselyAdapterImports(
        'import { a, b as c, type D } from "@better-auth/kysely-adapter";\nimport { x } from "other";',
      ),
    ).toEqual(["a", "b"]);
  });

  it("exports every name better-auth imports from @better-auth/kysely-adapter", () => {
    const imported = new Set(
      listModules(betterAuthDist).flatMap((file) =>
        namedKyselyAdapterImports(readFileSync(file, "utf8")),
      ),
    );
    // Guards against the scan silently finding nothing (e.g. a dist layout change).
    expect(imported.has("createKyselyAdapter")).toBe(true);
    const missing = [...imported].filter((name) => !(name in stub)).sort();
    expect(missing).toEqual([]);
  });

  it("keeps the migration helpers inert", async () => {
    await expect(stub.introspectPostgresTables()).resolves.toEqual([]);
    await expect(stub.getPostgresSchema()).resolves.toBe("public");
    expect(stub.getKyselyDatabaseType()).toBeNull();
  });
});
