import { NextResponse } from "next/server";
import {
  teamsNDT,
  teamsVLD,
  teamsNFA,
  teamsVPF,
  teamsVCX,
} from "@/lib/debate-data/debate-metadata/debate-school-names";

type FormatKey = "ndt" | "vld" | "nfa" | "vpf" | "vcx";

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

export async function GET() {
  return NextResponse.json({
    all: ALL_SCHOOLS,
    byFormat: SCHOOLS_BY_FORMAT,
    total: ALL_SCHOOLS.length,
  });
}
