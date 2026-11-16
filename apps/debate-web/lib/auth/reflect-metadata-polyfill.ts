/**
 * @fileoverview Minimal `Reflect` metadata polyfill, installed before the
 * passkey server code loads.
 *
 * `@better-auth/passkey` → `@simplewebauthn/server` → `@peculiar/x509` →
 * `tsyringe`, and tsyringe throws at module evaluation ("tsyringe requires a
 * reflect polyfill") when `Reflect.getMetadata` is missing. x509 does
 * `import "reflect-metadata"` itself, but that package is CommonJS: the
 * bundler wraps it in a lazy initializer and calls it from x509's own body,
 * which runs *after* the (ESM) tsyringe module has already thrown. The Worker
 * then fails to start (Cloudflare deploy error 10021).
 *
 * This module is plain ESM with no imports, and ./security-plugins imports it
 * before `@better-auth/passkey`, so module order guarantees it runs first.
 * When the real `reflect-metadata` initializes later it finds these functions
 * and wraps them as its fallback provider, so metadata written by either is
 * visible to both. Only installed when nothing else has.
 */

type MetadataKey = unknown
type Target = object
type PropertyKey_ = string | symbol | undefined

interface ReflectMetadataApi {
  defineMetadata(key: MetadataKey, value: unknown, target: Target, property?: PropertyKey_): void
  hasMetadata(key: MetadataKey, target: Target, property?: PropertyKey_): boolean
  hasOwnMetadata(key: MetadataKey, target: Target, property?: PropertyKey_): boolean
  getMetadata(key: MetadataKey, target: Target, property?: PropertyKey_): unknown
  getOwnMetadata(key: MetadataKey, target: Target, property?: PropertyKey_): unknown
  getMetadataKeys(target: Target, property?: PropertyKey_): MetadataKey[]
  getOwnMetadataKeys(target: Target, property?: PropertyKey_): MetadataKey[]
  deleteMetadata(key: MetadataKey, target: Target, property?: PropertyKey_): boolean
  metadata(key: MetadataKey, value: unknown): (target: Target, property?: PropertyKey_) => void
}

/** Installs the polyfill on `reflect` unless `getMetadata` already exists. Returns whether it installed. */
export function installReflectMetadata(reflect: object = Reflect): boolean {
  const r = reflect as Partial<ReflectMetadataApi>
  if (typeof r.getMetadata === "function") return false

  const store = new WeakMap<Target, Map<PropertyKey_, Map<MetadataKey, unknown>>>()

  const ownMap = (target: Target, property: PropertyKey_, create: boolean) => {
    let byProperty = store.get(target)
    if (!byProperty) {
      if (!create) return undefined
      byProperty = new Map()
      store.set(target, byProperty)
    }
    let map = byProperty.get(property)
    if (!map) {
      if (!create) return undefined
      map = new Map()
      byProperty.set(property, map)
    }
    return map
  }

  const assertTarget = (target: unknown): Target => {
    if (target === null || (typeof target !== "object" && typeof target !== "function")) {
      throw new TypeError("Reflect metadata target must be an object")
    }
    return target as Target
  }

  const api: ReflectMetadataApi = {
    defineMetadata(key, value, target, property) {
      ownMap(assertTarget(target), property, true)!.set(key, value)
    },
    hasOwnMetadata(key, target, property) {
      return ownMap(assertTarget(target), property, false)?.has(key) ?? false
    },
    hasMetadata(key, target, property) {
      for (let t: Target | null = assertTarget(target); t; t = Object.getPrototypeOf(t)) {
        if (api.hasOwnMetadata(key, t, property)) return true
      }
      return false
    },
    getOwnMetadata(key, target, property) {
      return ownMap(assertTarget(target), property, false)?.get(key)
    },
    getMetadata(key, target, property) {
      for (let t: Target | null = assertTarget(target); t; t = Object.getPrototypeOf(t)) {
        const map = ownMap(t, property, false)
        if (map?.has(key)) return map.get(key)
      }
      return undefined
    },
    getOwnMetadataKeys(target, property) {
      return [...(ownMap(assertTarget(target), property, false)?.keys() ?? [])]
    },
    getMetadataKeys(target, property) {
      const keys = new Set<MetadataKey>()
      for (let t: Target | null = assertTarget(target); t; t = Object.getPrototypeOf(t)) {
        for (const key of api.getOwnMetadataKeys(t, property)) keys.add(key)
      }
      return [...keys]
    },
    deleteMetadata(key, target, property) {
      return ownMap(assertTarget(target), property, false)?.delete(key) ?? false
    },
    metadata(key, value) {
      return (target, property) => api.defineMetadata(key, value, target, property)
    },
  }

  for (const [name, fn] of Object.entries(api)) {
    Object.defineProperty(reflect, name, { value: fn, configurable: true, writable: true, enumerable: false })
  }
  return true
}

installReflectMetadata()
