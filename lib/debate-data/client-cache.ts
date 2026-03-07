import Fuse from "fuse.js";

const TOURNAMENTS_ENDPOINT = "/api/tournaments";
const SCHOOLS_ENDPOINT = "/api/schools";

type SchoolsPayload = {
  all: string[];
  byFormat: Record<string, string[]>;
};

type TournamentsPayload = {
  tournaments: string[];
};

let cachedTournaments: string[] | null = null;
let tournamentsFuse: Fuse<string> | null = null;

let cachedSchools: SchoolsPayload | null = null;
let schoolsFuse: Fuse<string> | null = null;

async function loadTournaments(): Promise<string[]> {
  if (cachedTournaments) return cachedTournaments;
  try {
    const res = await fetch(TOURNAMENTS_ENDPOINT);
    if (!res.ok) {
      throw new Error(`Tournament API returned ${res.status}`);
    }
    const data = (await res.json()) as TournamentsPayload;
    cachedTournaments = data.tournaments ?? [];
  } catch (error) {
    console.error("Unable to load tournament list:", error);
    cachedTournaments = [];
  }
  return cachedTournaments;
}

async function loadSchools(): Promise<SchoolsPayload> {
  if (cachedSchools) return cachedSchools;
  try {
    const res = await fetch(SCHOOLS_ENDPOINT);
    if (!res.ok) {
      throw new Error(`Schools API returned ${res.status}`);
    }
    const data = (await res.json()) as SchoolsPayload;
    cachedSchools = {
      all: data.all ?? [],
      byFormat: data.byFormat ?? {},
    };
  } catch (error) {
    console.error("Unable to load school list:", error);
    cachedSchools = { all: [], byFormat: {} };
  }
  return cachedSchools;
}

function buildFuse(list: string[], existing?: Fuse<string>): Fuse<string> {
  if (existing) return existing;
  return new Fuse(list, {
    threshold: 0.4,
    includeScore: true,
    minMatchCharLength: 1,
  });
}

export async function searchTournaments(query = "", limit = 10): Promise<string[]> {
  const list = await loadTournaments();
  if (!query) {
    return list.slice(0, limit);
  }
  tournamentsFuse = buildFuse(list, tournamentsFuse);
  return tournamentsFuse.search(query, { limit }).map((result) => result.item);
}

export async function searchSchools(query = "", limit = 10): Promise<string[]> {
  const { all } = await loadSchools();
  if (!query) {
    return all.slice(0, limit);
  }
  schoolsFuse = buildFuse(all, schoolsFuse);
  return schoolsFuse.search(query, { limit }).map((result) => result.item);
}

export async function getSchoolsByFormat(): Promise<Record<string, string[]>> {
  const { byFormat } = await loadSchools();
  return byFormat;
}
