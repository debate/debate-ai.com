"use client";

import { useEffect } from "react";
import { authClient } from "@/lib/auth/client";
import { useSession } from "@/lib/hooks/useSession";

export function OneTap() {
  const { isAuthenticated, isLoading } = useSession();

  useEffect(() => {
    if (isLoading || isAuthenticated) return;
    authClient.oneTap();
  }, [isLoading, isAuthenticated]);

  return null;
}
