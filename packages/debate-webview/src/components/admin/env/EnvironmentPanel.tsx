"use client";

import { useEffect, useState } from "react";
import { type EnvStatus, type RebuildResult, api } from "./api";
import { AuditSection, BuildSection } from "./BuildSection";
import { CredentialsSection } from "./CredentialsSection";
import { VariablesSection } from "./VariablesSection";

/**
 * Admin → Environment: connect a Cloudflare API token and a GitHub token, edit
 * the Worker's variables and secrets with a reviewed diff, and rebuild so the
 * change ships (`/api/admin/env/*`). Tokens and secret values never come back
 * from the server.
 */
export function EnvironmentPanel() {
  const [status, setStatus] = useState<EnvStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rebuild, setRebuild] = useState<RebuildResult | null>(null);
  const [auditKey, setAuditKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api<{ status: EnvStatus }>("/credentials")
      .then((res) => !cancelled && setStatus(res.status))
      .catch((caught: Error) => !cancelled && setError(caught.message));
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p className="text-destructive text-sm">{error}</p>;
  if (!status) return <p className="text-muted-foreground text-sm">Loading…</p>;

  const refreshAudit = () => setAuditKey((key) => key + 1);
  return (
    <>
      <CredentialsSection
        status={status}
        onStatus={(next) => {
          setStatus(next);
          refreshAudit();
        }}
      />
      <VariablesSection
        enabled={status.cloudflare.set && Boolean(status.cloudflare.accountId)}
        canRebuild={status.github.set}
        onRebuild={(result) => {
          setRebuild(result);
          refreshAudit();
        }}
        onApplied={refreshAudit}
      />
      <BuildSection
        canRebuild={status.github.set}
        result={rebuild}
        onResult={(next) => {
          setRebuild(next);
          refreshAudit();
        }}
      />
      <AuditSection refreshKey={auditKey} />
    </>
  );
}
