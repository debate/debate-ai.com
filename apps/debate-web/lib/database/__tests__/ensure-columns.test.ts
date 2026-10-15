import { describe, expect, it } from "vitest"
import { getTableConfig } from "drizzle-orm/sqlite-core"
import { userSettings } from "../schema"
import { planMissingColumnAdds } from "../ensure-columns"

const columns = getTableConfig(userSettings).columns

describe("planMissingColumnAdds", () => {
  it("adds nothing when every column is present", () => {
    expect(planMissingColumnAdds("user_settings", columns, columns.map((c) => c.name))).toEqual([])
  })

  it("adds a missing nullable column such as flow_auto_save", () => {
    const existing = columns.map((c) => c.name).filter((name) => name !== "flow_auto_save")
    expect(planMissingColumnAdds("user_settings", columns, existing)).toEqual([
      'ALTER TABLE "user_settings" ADD COLUMN "flow_auto_save" text',
    ])
  })

  it("never adds the primary key or a NOT NULL column without a default", () => {
    const cols = [
      { name: "id", primary: true, notNull: true, hasDefault: false, getSQLType: () => "text" },
      { name: "required", primary: false, notNull: true, hasDefault: false, getSQLType: () => "text" },
      { name: "count", primary: false, notNull: true, hasDefault: true, default: 0, getSQLType: () => "integer" },
      { name: "dyn", primary: false, notNull: false, hasDefault: true, default: () => 1, getSQLType: () => "integer" },
    ]
    expect(planMissingColumnAdds("t", cols, [])).toEqual(['ALTER TABLE "t" ADD COLUMN "count" integer DEFAULT 0 NOT NULL'])
  })

  it("matches existing names case-insensitively", () => {
    const existing = columns.map((c) => c.name.toUpperCase())
    expect(planMissingColumnAdds("user_settings", columns, existing)).toEqual([])
  })
})
