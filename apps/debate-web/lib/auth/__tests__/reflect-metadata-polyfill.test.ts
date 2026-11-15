import { describe, expect, it } from "vitest"
import { installReflectMetadata } from "../reflect-metadata-polyfill"

type Api = {
  defineMetadata(k: unknown, v: unknown, t: object, p?: string | symbol): void
  getMetadata(k: unknown, t: object, p?: string | symbol): unknown
  getOwnMetadata(k: unknown, t: object, p?: string | symbol): unknown
  hasMetadata(k: unknown, t: object, p?: string | symbol): boolean
  hasOwnMetadata(k: unknown, t: object, p?: string | symbol): boolean
  getMetadataKeys(t: object, p?: string | symbol): unknown[]
  getOwnMetadataKeys(t: object, p?: string | symbol): unknown[]
  deleteMetadata(k: unknown, t: object, p?: string | symbol): boolean
  metadata(k: unknown, v: unknown): (t: object, p?: string | symbol) => void
}

describe("reflect-metadata polyfill", () => {
  it("is installed on the global Reflect once security-plugins loads (tsyringe's load-time check)", async () => {
    await import("../security-plugins")
    expect(typeof (Reflect as unknown as Api).getMetadata).toBe("function")
  })

  it("leaves an existing implementation alone", () => {
    const existing = () => "theirs"
    const target = { getMetadata: existing }
    expect(installReflectMetadata(target)).toBe(false)
    expect(target.getMetadata).toBe(existing)
  })

  it("stores own metadata per target and property, and inherits along the prototype chain", () => {
    const r = {} as Api
    expect(installReflectMetadata(r)).toBe(true)

    class Base {}
    class Child extends Base {}
    r.defineMetadata("design:paramtypes", [String], Base)
    r.metadata("role", "child")(Child, "method")

    expect(r.getMetadata("design:paramtypes", Child)).toEqual([String])
    expect(r.getOwnMetadata("design:paramtypes", Child)).toBeUndefined()
    expect(r.hasMetadata("design:paramtypes", Child)).toBe(true)
    expect(r.hasOwnMetadata("design:paramtypes", Child)).toBe(false)
    expect(r.getMetadata("role", Child, "method")).toBe("child")
    expect(r.getMetadata("role", Child)).toBeUndefined()
    expect(r.getOwnMetadataKeys(Child, "method")).toEqual(["role"])
    expect(r.getMetadataKeys(Child)).toEqual(["design:paramtypes"])

    expect(r.deleteMetadata("role", Child, "method")).toBe(true)
    expect(r.hasMetadata("role", Child, "method")).toBe(false)
  })

  it("rejects non-object targets like reflect-metadata does", () => {
    const r = {} as Api
    installReflectMetadata(r)
    expect(() => r.getMetadata("k", 1 as unknown as object)).toThrow(TypeError)
  })
})
