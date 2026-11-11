/**
 * @fileoverview Admin impersonation through better-auth's `admin` plugin.
 *
 * The plugin decides who is an admin from `user.role` (or a fixed
 * `adminUserIds` list), but this app's admins are the ADMIN_EMAILS allowlist
 * (./admin.ts). Rather than keep two sources of truth, the before-hook here
 * makes the allowlist the only one:
 *
 * - Only `/admin/impersonate-user` and `/admin/stop-impersonating` are
 *   reachable. Every other plugin endpoint (set-role, ban-user, remove-user,
 *   list-users, …) answers 404, so nothing can grant a role or ban anyone.
 * - Before an impersonation, the caller must be on the allowlist and must not
 *   already be impersonating someone; the target must not be on it (admins
 *   can't impersonate admins). The caller's `user.role` is then written as
 *   `"admin"` so the plugin's own permission check — which re-reads the
 *   session from the database — passes. A caller who is not on the list has
 *   any stale `"admin"` role cleared.
 *
 * The impersonated session lasts {@link IMPERSONATION_SESSION_SECONDS}; the
 * plugin keeps the admin's own session in a signed `admin_session` cookie,
 * which `stop-impersonating` swaps back in.
 */
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { isAdminEmail } from "./admin";

/** How long an impersonated session lives before it simply expires. */
export const IMPERSONATION_SESSION_SECONDS = 60 * 30;

/** The admin-plugin endpoints this app exposes; the rest answer 404. */
export const ALLOWED_ADMIN_PLUGIN_PATHS: readonly string[] = [
  "/admin/impersonate-user",
  "/admin/stop-impersonating",
];

/** The role the admin plugin treats as an administrator. */
export const ADMIN_PLUGIN_ROLE = "admin";

interface ImpersonationUser {
  id: string;
  email?: string | null;
}

export type ImpersonationRefusal = { status: "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "BAD_REQUEST"; message: string };

/**
 * Whether `caller` may impersonate `target`. Pure, so the rules are testable
 * without a database: returns the refusal, or null when it is allowed.
 */
export function checkImpersonation(
  caller: (ImpersonationUser & { impersonatedBy?: string | null }) | null,
  target: ImpersonationUser | null,
  adminEmails?: string[],
): ImpersonationRefusal | null {
  if (!caller) return { status: "UNAUTHORIZED", message: "Sign in as an admin first." };
  if (caller.impersonatedBy) {
    return { status: "FORBIDDEN", message: "Return to your admin account before impersonating someone else." };
  }
  if (!isAdminEmail(caller.email, adminEmails)) {
    return { status: "FORBIDDEN", message: "Only admins can impersonate users." };
  }
  if (!target) return { status: "NOT_FOUND", message: "User not found." };
  if (target.id === caller.id) return { status: "BAD_REQUEST", message: "You are already signed in as this account." };
  if (isAdminEmail(target.email, adminEmails)) {
    return { status: "FORBIDDEN", message: "Admins can't impersonate other admins." };
  }
  return null;
}

/** better-auth `hooks.before`: enforces the rules above on the admin plugin's routes. */
export const adminPluginGuard = createAuthMiddleware(async (ctx) => {
  const path = ctx.path;
  if (!path?.startsWith("/admin/")) return;
  if (!ALLOWED_ADMIN_PLUGIN_PATHS.includes(path)) {
    throw APIError.fromStatus("NOT_FOUND");
  }
  if (path !== "/admin/impersonate-user") return;

  const current = await getSessionFromCtx(ctx);
  const userId = (ctx.body as { userId?: unknown } | undefined)?.userId;
  const target =
    typeof userId === "string" && userId ? await ctx.context.internalAdapter.findUserById(userId) : null;

  const callerUser = current?.user as (ImpersonationUser & { role?: string | null }) | undefined;
  const caller = callerUser
    ? {
        ...callerUser,
        impersonatedBy: (current?.session as { impersonatedBy?: string | null } | undefined)?.impersonatedBy,
      }
    : null;

  const refusal = checkImpersonation(caller, target);
  if (refusal) {
    // Someone who has fallen off the allowlist loses the plugin role too.
    if (callerUser && callerUser.role === ADMIN_PLUGIN_ROLE && !isAdminEmail(callerUser.email)) {
      await ctx.context.internalAdapter.updateUser(callerUser.id, { role: null });
    }
    throw APIError.fromStatus(refusal.status, { message: refusal.message });
  }

  if (callerUser && callerUser.role !== ADMIN_PLUGIN_ROLE) {
    await ctx.context.internalAdapter.updateUser(callerUser.id, { role: ADMIN_PLUGIN_ROLE });
  }
  // A former admin keeps no plugin role, or the plugin would refuse them as a target.
  if (target && (target as { role?: string | null }).role === ADMIN_PLUGIN_ROLE) {
    await ctx.context.internalAdapter.updateUser(target.id, { role: null });
  }
});
