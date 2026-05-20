import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "data/videos");
const fix = process.argv.includes("--fix");

const files = [
  "debate-lectures.json",
  "debate-top-picks.json",
  "rounds-college.json",
  "rounds-ld.json",
  "rounds-pf.json",
  "rounds-policy.json",
];

// Track all seen IDs: id -> [{ file, index, entry }]
const seen = {};
const parsed = {};

for (const file of files) {
  const path = join(dataDir, file);
  const json = JSON.parse(readFileSync(path, "utf8"));
  parsed[file] = json;
  const entries = json.data ?? json;

  entries.forEach((entry, index) => {
    const id = Array.isArray(entry) ? entry[0] : entry.id;
    if (!id) return;
    if (!seen[id]) seen[id] = [];
    seen[id].push({ file, index, title: Array.isArray(entry) ? entry[1] : entry.title });
  });
}

const duplicates = Object.entries(seen).filter(([, locs]) => locs.length > 1);

if (duplicates.length === 0) {
  console.log("No duplicates found.");
} else {
  console.log(`Found ${duplicates.length} duplicate video ID(s):\n`);
  for (const [id, locs] of duplicates) {
    console.log(`ID: ${id}`);
    for (const { file, index, title } of locs) {
      console.log(`  [${file}] index ${index}: "${title}"`);
    }
    console.log();
  }

  if (fix) {
    // Keep the first occurrence, remove the rest
    const toRemove = {}; // file -> Set of indices to remove
    for (const [, locs] of duplicates) {
      for (const { file, index } of locs.slice(1)) {
        if (!toRemove[file]) toRemove[file] = new Set();
        toRemove[file].add(index);
      }
    }

    for (const [file, indices] of Object.entries(toRemove)) {
      const json = parsed[file];
      const entries = json.data ?? json;
      const filtered = entries.filter((_, i) => !indices.has(i));
      if (json.data) json.data = filtered;
      const path = join(dataDir, file);
      writeFileSync(path, JSON.stringify(json, null, 2) + "\n");
      console.log(`Fixed ${indices.size} duplicate(s) in ${file}`);
    }
    console.log("\nDone.");
  }
}
