import { getAuth } from "./index";
import { headers } from "next/headers";

export interface AuthSession {
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
    /** better-auth organization plugin: the organization this session works in, or null for the personal workspace. */
    activeOrganizationId?: string | null;
  };
  user: {
    id: string;
    name: string;
    email: string;
    image?: string;
  };
}

export async function getSession(): Promise<AuthSession | null> {
  try {
    const auth = await getAuth();
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    return session as AuthSession | null;
  } catch (error) {
    console.error("Session retrieval error:", error);
    return null;
  }
}

export async function requireSession(): Promise<AuthSession> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

export async function getUserId(): Promise<string | null> {
  const session = await getSession();
  return session?.user?.id ?? null;
}

export async function requireUserId(): Promise<string> {
  const session = await requireSession();
  return session.user.id;
}
