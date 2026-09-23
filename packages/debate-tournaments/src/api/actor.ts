/**
 * The `req.actor` upstream's authorization middleware and controllers read,
 * built from the host app's own signed-in user rather than a Tabroom session.
 *
 * A host user is matched to a Tabroom `person` by email. When one exists, the
 * actor carries it as `Person` (so person-scoped routes such as student search
 * see a real Tabroom account); when not, the actor is still signed in — enough
 * for routes that only require a login, like paradigm search — but has no
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
  return {
    type: "person",
    id: person?.id,
    Person: person,
    can: deny,
    assert: forbid,
    allowedIds: none,
  };
}
