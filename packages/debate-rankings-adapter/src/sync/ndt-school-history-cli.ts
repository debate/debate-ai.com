/**
 * @fileoverview CLI: `bun run build-ndt-history -- <ndt-history.html>` parses
 * the National Debate Tournament's school-history export and writes
 * `data/ndt-school-history.json`.
 * @module sync/ndt-school-history-cli
 */

import { readFileSync, writeFileSync } from "node:fs"
import { parseNdtSchoolHistory } from "./ndt-school-history"

const input = process.argv[2]
if (!input) {
  console.error("usage: bun run build-ndt-history -- <ndt-history.html>")
  process.exit(1)
}

const schools = parseNdtSchoolHistory(readFileSync(input, "utf8"))
const output = new URL("../../data/ndt-school-history.json", import.meta.url)
writeFileSync(output, `${JSON.stringify(schools)}\n`)
console.log(`Wrote ${schools.length} schools to ${output.pathname}`)
