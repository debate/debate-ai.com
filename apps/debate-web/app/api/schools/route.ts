import { NextResponse } from "next/server";
import {
  teamsNDT,
  teamsVLD,
  teamsNFA,
  teamsVPF,
  teamsVCX,
} from "@debate-ai/rankings/data/debate-school-names";
import { getDBFromContext } from "@/lib/database/context";
import { listProfileSchoolNames } from "@/lib/school-claims/queries";

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

/**
 * Every school name: the per-format ranking lists, plus schools users created
 * when claiming one (`school_profiles`), which the claim dropdown offers too.
 * `created` lists those alone; a database failure leaves it empty.
 */
export async function GET() {
  let created: string[] = [];
  try {
    created = await listProfileSchoolNames(await getDBFromContext());
  } catch (error) {
    console.error("Failed to read created schools:", error);
  }
  const listed = new Set(ALL_SCHOOLS);
  const extra = created.filter((name) => !listed.has(name));
  return NextResponse.json({
    all: extra.length ? [...ALL_SCHOOLS, ...extra].sort() : ALL_SCHOOLS,
    created: extra,
    byFormat: SCHOOLS_BY_FORMAT,
    total: ALL_SCHOOLS.length + extra.length,
  });
}
