/**
 * The `req.actor` upstream's authorization middleware and controllers read,
 * built from the host app's own signed-in user rather than a Tabroom session.
 *
 * A host user is matched to a Tabroom `person` by email. When one exists, the
 * actor carries it as `Person` (so person-scoped routes such as student search
 * see a real Tabroom account) along with the `permission` rows that person
 * holds, so `can`/`assert` answer from this app's own `owner` rows rather than
 * denying everything; when not, the actor is still signed in — enough for
 * routes that only require a login, like paradigm search — but has no
 * `Person`, which upstream's person-scoped routes reject on their own.
 */

import { getTabroomKysely } from "../db/runtime";

export interface HostUser {
  email?: string | null;
  name?: string | null;
}

export interface TabroomPerson {
  id: number;
  first: string | null;
  last: string | null;
  email: string;
  site_admin: number | null;
  tz?: string | null;
}

export interface TabroomActor {
  type: "person" | "anonymous";
  id?: number;
  Person?: TabroomPerson;
  can: (resource: string, action: string, resourceId?: number) => Promise<boolean>;
  assert: (resource: string, action: string, resourceId?: number) => Promise<void>;
  allowedIds: () => { all: boolean; ids: number[] };
}

const deny = async () => false;
const forbid = async () => {
  const err = Object.assign(new Error("Forbidden"), { status: 403, code: "AUTH_FORBIDDEN" });
  throw err;
};
const none = () => ({ all: false, ids: [] as number[] });

export const anonymousActor: TabroomActor = { type: "anonymous", can: deny, assert: forbid, allowedIds: none };

/** Looks up the Tabroom person with `email`, if any. Must run inside a database scope. */
export async function findPersonByEmail(email: string): Promise<TabroomPerson | undefined> {
  const row = await getTabroomKysely()
    .selectFrom("person")
    .select(["id", "first", "last", "email", "site_admin", "tz"])
    .where("email", "=", email.trim().toLowerCase())
    .executeTakeFirst();
  return row as TabroomPerson | undefined;
}

/**
 * The permissions a person holds, grouped by tournament.
 *
 * Only rows carrying a `tourn` are collected: circuit, chapter, region and
 * district permissions describe access to a circuit or chapter's account
 * pages, not to a tournament's ballots, so they grant nothing here.
 */
export async function findPersonPermissions(
  personId: number,
): Promise<Array<{ tourn: number; tag: string | null; event: number | null; category: number | null }>> {
  const rows = await getTabroomKysely()
    .selectFrom("permission")
    .select(["tourn", "tag", "event", "category"])
    .where("person", "=", personId)
    .where("tourn", "is not", null)
    .execute();
  return rows as Array<{ tourn: number; tag: string | null; event: number | null; category: number | null }>;
}

/** A permission tag's authority, strongest first. */
const RANK: Record<string, number> = { owner: 3, admin: 2, editor: 1 };

/**
 * An actor with real `can`/`assert`, built from the `permission` rows
 * `personId` holds.
 *
 * `owner` implies every other tag, so a tournament's owner can read, update
 * and delete it. A `resourceId` narrows the check to one tournament — without
 * it, `can("tourn", "read")` answers for any tournament the person touches,
 * which is how upstream's route-level guards call it.
 */
export function permissionActor(person: TabroomPerson, permissions: Awaited<ReturnType<typeof findPersonPermissions>>): TabroomActor {
  const rankFor = (tournId: number | undefined): number => {
    let rank = person.site_admin ? RANK.owner : 0;
    for (const permission of permissions) {
      if (tournId !== undefined && permission.tourn !== tournId) continue;
      rank = Math.max(rank, RANK[permission.tag ?? ""] ?? 0);
    }
    return rank;
  };

  const can = async (resource: string, action: string, resourceId?: number) => {
    if (resource !== "tourn") return false;
    const needed = action === "owner" ? RANK.owner : action === "update" ? RANK.admin : 1;
    return rankFor(resourceId) >= needed;
  };

  return {
    type: "person",
    id: person.id,
    Person: person,
    can,
    assert: async (resource, action, resourceId) => {
      if (await can(resource, action, resourceId)) return;
      await forbid();
    },
    allowedIds: () => {
      const ids = permissions.filter((permission) => RANK[permission.tag ?? ""]).map((permission) => permission.tourn);
      return person.site_admin ? { all: true, ids } : { all: false, ids: [...new Set(ids)] };
    },
  };
}

/**
 * The actor for a host-app user (or {@link anonymousActor} for none). Site
 * admin rights are never granted from the host side: `site_admin` comes only
 * from the matched Tabroom person row.
 */
export async function actorForHostUser(user: HostUser | null | undefined): Promise<TabroomActor> {
  if (!user?.email) return anonymousActor;
  let person: TabroomPerson | undefined;
  try {
    person = await findPersonByEmail(user.email);
  } catch {
    person = undefined;
  }
  if (!person) {
    // Signed in to the host app but no Tabroom account yet: a real actor with
    // no `Person`, so login-only routes work and person-scoped ones still
    // reject on their own.
    return { type: "person", can: deny, assert: forbid, allowedIds: none };
  }
  let permissions: Awaited<ReturnType<typeof findPersonPermissions>> = [];
  try {
    permissions = await findPersonPermissions(person.id);
  } catch {
    permissions = [];
  }
  return permissionActor(person, permissions);
}
