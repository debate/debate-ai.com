"use client";

import { authClient } from "../client";

export function useSession() {
  const { data: session, isPending } = authClient.useSession();

  return {
    session,
    user: session?.user ?? null,
    isAuthenticated: !!session?.user,
    isLoading: isPending,
  };
}
