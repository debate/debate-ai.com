import { and, eq, inArray } from "drizzle-orm"
import { getAuth } from "@/lib/auth"
import { getDBFromContext } from "@/lib/database/context"
import { documents, savedFlows, topicStarterItems } from "@/lib/database/schema"
import { getEnv } from "@/lib/env"
import { DEMO_ACCOUNT, buildDemoSeed, deriveFlowLabel, isDemoAccountEmail } from "debate-round"

/**
 * The shared demo account (docs/features/user-library.md, "Demo account"):
 * a stable, publicly sign-in-able user pre-loaded with sample documents,
 * saved flows, and shared files so a visitor can tour `/library`, the
 * Reason Editor, and the flow workspace before creating an account.
 *
 * - The account's identity and seed content come from `debate-round`'s
 *   `state/demoAccount.ts` (unit-tested there).
 * - The password is never typed by anyone: it's derived from the
 *   deployment's `BETTER_AUTH_SECRET` (or overridden by
 *   `DEMO_ACCOUNT_PASSWORD`), so the only way in is `POST /api/demo/login`.
 * - `DEMO_ACCOUNT_DISABLED=true` turns the whole feature off; the login
 *   form hides its button when `GET /api/demo` reports `enabled: false`.
 */

export function isDemoAccountEnabled(): boolean {
  return (getEnv("DEMO_ACCOUNT_DISABLED") ?? "").trim().toLowerCase() !== "true"
}

/** Whether the given signed-in email is the demo account (so UIs can offer "Reset demo data"). */
export { isDemoAccountEmail }

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

/** The demo account's password — explicit env override, else derived from the auth secret. */
export async function getDemoAccountPassword(): Promise<string> {
  const explicit = getEnv("DEMO_ACCOUNT_PASSWORD")
  if (explicit) return explicit
  const secret = getEnv("BETTER_AUTH_SECRET") || "dev-secret-change-in-production"
  return `demo-${(await sha256Hex(`${secret}:${DEMO_ACCOUNT.email}`)).slice(0, 32)}`
}

/**
 * Finds or creates the demo user and makes sure it has a credential
 * account carrying the current password (so rotating the secret or the
 * env override never locks the demo out). Returns the user's id.
 */
export async function ensureDemoUser(): Promise<{ id: string; email: string; name: string }> {
  const auth = await getAuth()
  const ctx = await auth.$context
  const password = await getDemoAccountPassword()
  const hashed = await ctx.password.hash(password)

  const found = await ctx.internalAdapter.findUserByEmail(DEMO_ACCOUNT.email, { includeAccounts: true })
  let userId: string
  if (found) {
    userId = found.user.id
    const credential = found.accounts.find((account) => account.providerId === "credential")
    if (!credential) {
      await ctx.internalAdapter.linkAccount({ userId, providerId: "credential", accountId: userId, password: hashed })
    } else if (!credential.password || !(await ctx.password.verify({ password, hash: credential.password }))) {
      await ctx.internalAdapter.updatePassword(userId, hashed)
    }
    if (!found.user.emailVerified || found.user.name !== DEMO_ACCOUNT.name) {
      await ctx.internalAdapter.updateUser(userId, { emailVerified: true, name: DEMO_ACCOUNT.name })
    }
  } else {
    // better-auth 1.7 added a second "provisioning source" argument; 1.6
    // (the pinned version) takes only the user. Passing the extra argument
    // is harmless on 1.6 and required on 1.7, so type it loosely here.
    const createUser = ctx.internalAdapter.createUser as unknown as (
      user: { email: string; name: string; emailVerified: boolean },
      source?: { method: string },
    ) => Promise<{ id: string }>
    const created = await createUser(
      { email: DEMO_ACCOUNT.email, name: DEMO_ACCOUNT.name, emailVerified: true },
      { method: "email-password" },
    )
    userId = created.id
    await ctx.internalAdapter.linkAccount({ userId, providerId: "credential", accountId: userId, password: hashed })
  }
  return { id: userId, email: DEMO_ACCOUNT.email, name: DEMO_ACCOUNT.name }
}

export interface DemoSeedCounts {
  documents: number
  flows: number
  sharedFiles: number
}

/**
 * Seeds the demo account's sample content idempotently — documents and
 * shared files by title, flows by their stable `Flow.id` — so signing in
 * again never duplicates anything. `reset` wipes the account's documents,
 * saved flows, and shared files first, restoring the pristine tour.
 * Returns how many rows were inserted this call.
 */
export async function seedDemoAccount(userId: string, options: { reset?: boolean } = {}): Promise<DemoSeedCounts> {
  const db = await getDBFromContext()
  const seed = buildDemoSeed()
  const counts: DemoSeedCounts = { documents: 0, flows: 0, sharedFiles: 0 }

  if (options.reset) {
    await db.delete(documents).where(eq(documents.userId, userId))
    await db.delete(savedFlows).where(eq(savedFlows.userId, userId))
    await db.delete(topicStarterItems).where(eq(topicStarterItems.ownerId, userId))
  }

  // Documents — folders first so files can reference them by title.
  const existingDocs: Array<{ id: number; title: string; isFolder: boolean }> = await db
    .select({ id: documents.id, title: documents.title, isFolder: documents.isFolder })
    .from(documents)
    .where(eq(documents.userId, userId))
  const folderIds = new Map<string, number>()
  for (const doc of existingDocs) if (doc.isFolder) folderIds.set(doc.title, doc.id)
  const existingTitles = new Set(existingDocs.map((doc) => doc.title))
  for (const doc of seed.documents.filter((entry) => entry.isFolder)) {
    if (existingTitles.has(doc.title)) continue
    const [created] = await db.insert(documents).values({ title: doc.title, content: "", userId, isFolder: true }).returning({ id: documents.id })
    folderIds.set(doc.title, created.id)
    existingTitles.add(doc.title)
    counts.documents++
  }
  for (const doc of seed.documents.filter((entry) => !entry.isFolder)) {
    if (existingTitles.has(doc.title)) continue
    await db.insert(documents).values({
      title: doc.title,
      content: doc.content,
      userId,
      parentId: doc.folder ? folderIds.get(doc.folder) ?? null : null,
      isFolder: false,
    })
    existingTitles.add(doc.title)
    counts.documents++
  }

  // Flows — keyed by the stable client id.
  const seedFlowIds = seed.flows.map((flow) => flow.id)
  const existingFlows: Array<{ clientId: number }> = await db
    .select({ clientId: savedFlows.clientId })
    .from(savedFlows)
    .where(and(eq(savedFlows.userId, userId), inArray(savedFlows.clientId, seedFlowIds)))
  const existingFlowIds = new Set(existingFlows.map((row) => row.clientId))
  for (const flow of seed.flows) {
    if (existingFlowIds.has(flow.id)) continue
    await db.insert(savedFlows).values({ userId, clientId: flow.id, label: deriveFlowLabel(flow), data: JSON.stringify(flow) })
    counts.flows++
  }

  // Shared files — keyed by title within the demo account's own rows.
  const existingShared: Array<{ title: string }> = await db
    .select({ title: topicStarterItems.title })
    .from(topicStarterItems)
    .where(eq(topicStarterItems.ownerId, userId))
  const sharedTitles = new Set(existingShared.map((row) => row.title))
  for (const file of seed.sharedFiles) {
    if (sharedTitles.has(file.title)) continue
    await db.insert(topicStarterItems).values({
      title: file.title,
      content: file.content,
      tags: JSON.stringify(file.tags),
      published: file.published,
      ownerId: userId,
      isFolder: false,
    })
    counts.sharedFiles++
  }

  return counts
}
