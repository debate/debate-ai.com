import { createClient } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"
import { beforeEach, describe, expect, it } from "vitest"

import * as schema from "../../database/schema"
import { resetEnsuredColumns } from "../../database/ensure-columns"
import { ensureOrganizationTables, resetEnsuredOrganizationTables } from "../ensure-tables"
import { canManageMembers, loadActiveOrganization } from "../server"

/**
 * A D1 from before the organization plugin: `user` and a `session` table
 * without `active_organization_id`. `ensureOrganizationTables` has to bring it
 * to the point where better-auth's session insert (which names that column)
 * and the membership reads work.
 */
async function legacyDb() {
  const client = createClient({ url: ":memory:" })
  await client.execute(`CREATE TABLE "user" (
    "id" text PRIMARY KEY NOT NULL, "name" text NOT NULL, "email" text NOT NULL UNIQUE,
    "email_verified" integer DEFAULT 0 NOT NULL, "image" text,
    "created_at" integer NOT NULL, "updated_at" integer NOT NULL, "is_anonymous" integer DEFAULT 0 NOT NULL
  )`)
  await client.execute(`CREATE TABLE "session" (
    "id" text PRIMARY KEY NOT NULL, "expires_at" integer NOT NULL, "token" text NOT NULL UNIQUE,
    "created_at" integer NOT NULL, "updated_at" integer NOT NULL, "ip_address" text, "user_agent" text,
    "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade
  )`)
  return drizzle(client, { schema })
}

const now = new Date()
const person = (id: string) => ({ id, name: id, email: `${id}@example.com`, createdAt: now, updatedAt: now })

describe("ensureOrganizationTables", () => {
  beforeEach(() => {
    resetEnsuredOrganizationTables()
    resetEnsuredColumns()
  })

  it("adds the session column and the organization tables to a legacy database", async () => {
    const db = await legacyDb()
    await ensureOrganizationTables(db)

    await db.insert(schema.user).values([person("ana"), person("ben"), person("cy")])
    await db.insert(schema.session).values({
      id: "s1",
      token: "t1",
      userId: "ana",
      expiresAt: now,
      createdAt: now,
      updatedAt: now,
      activeOrganizationId: "org1",
    })
    await db.insert(schema.organization).values({ id: "org1", name: "Lincoln", slug: "lincoln", createdAt: now })
    await db.insert(schema.member).values([
      { id: "m1", organizationId: "org1", userId: "ana", role: "owner", createdAt: now },
      { id: "m2", organizationId: "org1", userId: "ben", role: "member", createdAt: now },
    ])

    const org = await loadActiveOrganization(db as never, "ana", "org1")
    expect(org?.name).toBe("Lincoln")
    expect(org?.role).toBe("owner")
    expect([...(org?.memberIds ?? [])].sort()).toEqual(["ana", "ben"])
  })

  it("is a no-op the second time", async () => {
    const db = await legacyDb()
    await ensureOrganizationTables(db)
    resetEnsuredOrganizationTables()
    resetEnsuredColumns()
    await expect(ensureOrganizationTables(db)).resolves.toBeUndefined()
  })
})

describe("loadActiveOrganization", () => {
  beforeEach(() => {
    resetEnsuredOrganizationTables()
    resetEnsuredColumns()
  })

  it("is the personal workspace when no organization is set or the caller is not a member", async () => {
    const db = await legacyDb()
    await ensureOrganizationTables(db)
    await db.insert(schema.user).values([person("ana"), person("cy")])
    await db.insert(schema.organization).values({ id: "org1", name: "Lincoln", slug: "lincoln", createdAt: now })
    await db.insert(schema.member).values({ id: "m1", organizationId: "org1", userId: "ana", role: "owner", createdAt: now })

    expect(await loadActiveOrganization(db as never, "ana", null)).toBeNull()
    // A forged or stale id must not expose another group's members.
    expect(await loadActiveOrganization(db as never, "cy", "org1")).toBeNull()
  })

  it("is the personal workspace before the tables exist", async () => {
    const db = await legacyDb()
    expect(await loadActiveOrganization(db as never, "ana", "org1")).toBeNull()
  })
})

describe("canManageMembers", () => {
  it("lets owners and admins add members, not plain members", () => {
    expect(canManageMembers("owner")).toBe(true)
    expect(canManageMembers("member,admin")).toBe(true)
    expect(canManageMembers("member")).toBe(false)
  })
})
