"use client";

import { useState } from "react";
import { authClient } from "../../../lib/auth/client";
import { impersonatedByOf, stopImpersonating } from "../../../lib/auth/impersonation";

/**
 * Shown on every page while an admin is impersonating someone (the session's
 * `impersonatedBy` is set): whose account this is, and a button back to the
 * admin's own. Fixed to the top so it can't be missed or scrolled away.
 */
export function ImpersonationBanner() {
  const { data } = authClient.useSession();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!impersonatedByOf(data)) return null;

  const label = data?.user?.email || data?.user?.name || "another user";

  const onReturn = async () => {
    setPending(true);
    setError(null);
    try {
      await stopImpersonating();
    } catch (err) {
      setError((err as Error).message);
      setPending(false);
    }
  };

  return (
    <div
      role="status"
      data-impersonation-banner
      className="fixed inset-x-0 top-0 z-[1000] flex flex-wrap items-center justify-center gap-3 bg-amber-500 px-4 py-1.5 text-sm text-black shadow"
    >
      <span>
        Signed in as <strong>{label}</strong> (impersonating)
      </span>
      <button
        type="button"
        onClick={() => void onReturn()}
        disabled={pending}
        className="rounded border border-black/30 bg-white/80 px-2 py-0.5 font-medium hover:bg-white disabled:opacity-60"
      >
        {pending ? "Returning…" : "Return to admin"}
      </button>
      {error && <span className="text-red-900">{error}</span>}
    </div>
  );
}
