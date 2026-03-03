import { type NextRequest, NextResponse } from "next/server";
import Fuse from "fuse.js";
import {
  teamsNDT,
  teamsVLD,
  teamsNFA,
  teamsVPF,
  teamsVCX,
} from "@/lib/debate-data/debate-school-names";

type FormatKey = "ndt" | "vld" | "nfa" | "vpf" | "vcx";

const FORMAT_MAP: Record<FormatKey, string> = {
  ndt: teamsNDT,
  vld: teamsVLD,
  nfa: teamsNFA,
  vpf: teamsVPF,
  vcx: teamsVCX,
};

function parseSchools(raw: string): string[] {
  return raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Pre-build per-format school lists
const SCHOOLS_BY_FORMAT: Record<FormatKey, string[]> = {
  ndt: parseSchools(teamsNDT),
  vld: parseSchools(teamsVLD),
  nfa: parseSchools(teamsNFA),
  vpf: parseSchools(teamsVPF),
  vcx: parseSchools(teamsVCX),
};

// All unique schools across every format
const ALL_SCHOOLS: string[] = [
  ...new Set(Object.values(SCHOOLS_BY_FORMAT).flat()),
].sort();

// Fuse instances keyed by format (lazily created and cached)
const fuseCache: Partial<Record<FormatKey | "all", Fuse<string>>> = {};

function getFuse(key: FormatKey | "all"): Fuse<string> {
  if (!fuseCache[key]) {
    const list = key === "all" ? ALL_SCHOOLS : SCHOOLS_BY_FORMAT[key];
    fuseCache[key] = new Fuse(list, {
      threshold: 0.4,
      includeScore: true,
      minMatchCharLength: 1,
    });
  }
  return fuseCache[key]!;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = (searchParams.get("q") ?? "").trim();
  const format = (searchParams.get("format") ?? "").toLowerCase() as
    | FormatKey
    | "";
  const limit = Math.min(
    Number.parseInt(searchParams.get("limit") ?? "20", 10),
    100,
  );

  const validFormats: FormatKey[] = ["ndt", "vld", "nfa", "vpf", "vcx"];
  const fuseKey: FormatKey | "all" =
    format && validFormats.includes(format as FormatKey)
      ? (format as FormatKey)
      : "all";

  let results: string[];

  if (!q) {
    // No query – return the first `limit` entries from the selected list
    const list =
      fuseKey === "all" ? ALL_SCHOOLS : SCHOOLS_BY_FORMAT[fuseKey as FormatKey];
    results = list.slice(0, limit);
  } else {
    const fuse = getFuse(fuseKey);
    results = fuse
      .search(q, { limit })
      .map((r) => r.item);
  }

  return NextResponse.json({ results, total: results.length });
}
