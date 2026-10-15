/**
 * The linked-QwkSearch store against a real (in-memory) SQLite database that
 * starts without the `qwksearch_connection` table, as production does.
 */
import { createClient } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"
import { beforeEach, describe, expect, it, vi } from "vitest"
import * as schema from "../../database/schema"
import type { QwkSearchConnection } from "../connect"

const getDBFromContext = vi.fn()
vi.mock("../../database/context", () => ({
  getDBFromContext: () => getDBFromContext(),
}))

const { loadConnection, resetEnsuredTable, saveConnection } = await import("../store")

const CONNECTION: QwkSearchConnection = {
  apiKey: "qwk_abc",
  user: { id: "q1", name: "Ada", email: "ada@example.com", image: null },
  plan: "free",
  upgradeUrl: "https://buy.stripe.com/x",
  connectedAt: "2026-10-07T00:00:00.000Z",
}

describe("qwksearch connection store", () => {
  beforeEach(async () => {
    resetEnsuredTable()
    const client = createClient({ url: ":memory:" })
    await client.execute(`CREATE TABLE user (id TEXT PRIMARY KEY)`)
    await client.execute(`INSERT INTO user (id) VALUES ('user-1'), ('user-2')`)
    getDBFromContext.mockResolvedValue(drizzle(client, { schema }))
  })

  it("creates its table on first use and reads nothing for an unlinked user", async () => {
    expect(await loadConnection("user-1")).toBeNull()
  })

  it("saves, replaces and clears a user's link without touching others", async () => {
    await saveConnection("user-1", CONNECTION)
    await saveConnection("user-2", { ...CONNECTION, apiKey: "qwk_other" })
    expect(await loadConnection("user-1")).toEqual(CONNECTION)

    await saveConnection("user-1", { ...CONNECTION, plan: "pro", upgradeUrl: null })
    expect(await loadConnection("user-1")).toMatchObject({ plan: "pro", upgradeUrl: null, apiKey: "qwk_abc" })

    await saveConnection("user-1", null)
    expect(await loadConnection("user-1")).toBeNull()
    expect((await loadConnection("user-2"))?.apiKey).toBe("qwk_other")
  })
})
