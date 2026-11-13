import { spawn } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

type PackageManifest = {
  workspaces?: string[];
};

const root = process.cwd();

const excludedDirectories = new Set([
  "node_modules",
  ".git",
  "vendor",
  "dist",
  "build",
  ".next",
]);

async function isFile(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isFile();
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error.code === "ENOENT" || error.code === "ENOTDIR")
    ) {
      return false;
    }

    throw error;
  }
}

async function findManifests(directory: string): Promise<string[]> {
  const manifests: string[] = [];
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!excludedDirectories.has(entry.name)) {
        manifests.push(...(await findManifests(entryPath)));
      }
    } else if (entry.isFile() && entry.name === "package.json") {
      manifests.push(entryPath);
    }
  }

  return manifests;
}

function displayPath(directory: string): string {
  const relative = path.relative(root, directory);
  return relative ? `./${relative.split(path.sep).join("/")}` : ".";
}

async function expandWorkspacePattern(pattern: string): Promise<string[]> {
  if (!pattern.endsWith("/*")) {
    if (/[*?[\]{}]/.test(pattern)) {
      throw new Error(`Unsupported workspace pattern: ${pattern}`);
    }

    return [path.resolve(root, pattern)];
  }

  const basePattern = pattern.slice(0, -2);

  if (/[*?[\]{}]/.test(basePattern)) {
    throw new Error(`Unsupported workspace pattern: ${pattern}`);
  }

  const baseDirectory = path.resolve(root, basePattern);

  try {
    const entries = await readdir(baseDirectory, { withFileTypes: true });

    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(baseDirectory, entry.name));
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return [];
    }

    throw error;
  }
}

async function getRootWorkspaceMembers(): Promise<Set<string>> {
  const manifest = JSON.parse(
    await readFile(path.join(root, "package.json"), "utf8"),
  ) as PackageManifest;

  const patterns = manifest.workspaces ?? [];

  if (!Array.isArray(patterns) || !patterns.every((p) => typeof p === "string")) {
    throw new Error('Expected root "workspaces" to be an array of strings.');
  }

  const excluded = new Set<string>();

  for (const pattern of patterns) {
    if (pattern.startsWith("!")) {
      for (const directory of await expandWorkspacePattern(pattern.slice(1))) {
        excluded.add(directory);
      }
    }
  }

  const members = new Set<string>();

  for (const pattern of patterns) {
    if (pattern.startsWith("!")) continue;

    for (const directory of await expandWorkspacePattern(pattern)) {
      if (
        !excluded.has(directory) &&
        (await isFile(path.join(directory, "package.json")))
      ) {
        members.add(directory);
      }
    }
  }

  return members;
}

async function runBun(directory: string, args: string[]): Promise<void> {
  console.log(`\n[${displayPath(directory)}] bun ${args.join(" ")}`);

  // node:child_process rather than Bun.spawn: the web app's tsconfig
  // type-checks this script and has no Bun globals.
  const exitCode = await new Promise<number>((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: directory,
      env: process.env,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });

  if (exitCode !== 0) {
    throw new Error(
      `bun ${args.join(" ")} failed in ${displayPath(directory)} ` +
        `(exit ${exitCode})`,
    );
  }
}

async function hasLockfile(directory: string): Promise<boolean> {
  return (
    (await isFile(path.join(directory, "bun.lock"))) ||
    (await isFile(path.join(directory, "bun.lockb")))
  );
}

async function updateProject(
  directory: string,
  recursive: boolean,
): Promise<void> {
  // Initialize or synchronize the lockfile before attempting an update.
  await runBun(directory, ["install"]);

  if (!(await hasLockfile(directory))) {
    console.warn(
      `[${displayPath(directory)}] no Bun lockfile after install; skipping update`,
    );
    return;
  }

  await runBun(directory, [
    "update",
    "--latest",
    ...(recursive ? ["--recursive"] : []),
  ]);
}

async function main(): Promise<void> {
  const manifests = (await findManifests(root)).sort();

  if (manifests.length === 0) {
    console.log("No package.json files found.");
    return;
  }

  console.log("Found package manifests:");

  for (const manifest of manifests) {
    console.log(` - ${displayPath(path.dirname(manifest))}/package.json`);
  }

  const hasRootManifest = await isFile(path.join(root, "package.json"));
  const skip = hasRootManifest
    ? await getRootWorkspaceMembers()
    : new Set<string>();

  if (hasRootManifest) {
    console.log("\nUpdating root project and its workspace members.");
    await updateProject(root, true);
    skip.add(root);
  }

  const failures: string[] = [];

  for (const manifest of manifests) {
    const directory = path.dirname(manifest);

    if (skip.has(directory)) {
      if (directory !== root) {
        console.log(`Skipping workspace package: ${displayPath(directory)}`);
      }

      continue;
    }

    skip.add(directory);
    console.log(`\nUpdating standalone package: ${displayPath(directory)}`);

    try {
      await updateProject(directory, false);
    } catch (error) {
      failures.push(displayPath(directory));
      console.error(
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  if (failures.length > 0) {
    console.error("\nFailed standalone projects:");

    for (const directory of failures) {
      console.error(` - ${directory}`);
    }

    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});