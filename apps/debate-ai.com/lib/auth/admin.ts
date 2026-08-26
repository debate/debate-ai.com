import { getEnv } from "../env";
import { getSession } from "./session";

/**
 * Comma-separated allowlist of admin emails from ADMIN_EMAILS. An unset (or
 * empty) list means the admin area is open to everyone — useful for local
 * dev and single-operator deployments that haven't configured it yet.
 */
export function getAdminEmails(): string[] {
  const raw = getEnv("ADMIN_EMAILS");
  if (!raw) return [];
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export interface AdminAccess {
  isAdmin: boolean;
  email: string | null;
}

export async function getAdminAccess(): Promise<AdminAccess> {
  const session = await getSession();
  const email = session?.user?.email?.toLowerCase() ?? null;
  const adminEmails = getAdminEmails();

  if (adminEmails.length === 0) {
    return { isAdmin: true, email };
  }

  return { isAdmin: !!email && adminEmails.includes(email), email };
}
