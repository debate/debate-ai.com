"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@debate-ai/ui/primitives/button";
import { Badge } from "@debate-ai/ui/primitives/badge";
import { Input } from "@debate-ai/ui/primitives/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@debate-ai/ui/primitives/card";
import {
  fetchPendingSchoolClaims,
  reviewSchoolClaim,
  type PendingSchoolClaim,
} from "../../../lib/schools/school-claims";

/**
 * Claims to coach or run a school, waiting on review. Approving one makes the
 * claimant an owner of the school's page (its roster and logo); a claim on a
 * school that already has owners says so, so a second owner is a decision
 * rather than an accident. The claimant is notified either way.
 */
export function SchoolClaimsPanel() {
  const [claims, setClaims] = useState<PendingSchoolClaim[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setClaims((await fetchPendingSchoolClaims()).claims);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (claim: PendingSchoolClaim, decision: "approve" | "reject") => {
    setPending(claim.id);
    setError(null);
    try {
      await reviewSchoolClaim({ id: claim.id, decision, note: notes[claim.id]?.trim() || undefined });
      setClaims((current) => current?.filter((row) => row.id !== claim.id) ?? null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>School claims</CardTitle>
        <CardDescription>
          Users who say they coach or run a school. Approve to let them manage the school&apos;s teams, students and
          logo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {error && <p className="text-destructive">{error}</p>}
        {claims === null && !error && <p className="text-muted-foreground">Loading…</p>}
        {claims?.length === 0 && <p className="text-muted-foreground">No claims waiting.</p>}
        {claims?.map((claim) => (
          <div key={claim.id} className="space-y-2 rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`/@${claim.schoolSlug}`}
                target="_blank"
                rel="noreferrer"
                className="font-medium underline-offset-4 hover:underline"
              >
                {claim.schoolName}
              </a>
              {claim.isNewSchool && <Badge variant="secondary">New school</Badge>}
              <span className="text-muted-foreground">
                {claim.role === "admin" ? "Administrator" : "Coach"} · {claim.userName} ({claim.userEmail})
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {claim.emailVerified ? (
                <Badge>Verified {claim.schoolEmail}</Badge>
              ) : (
                <Badge variant="outline">No school email</Badge>
              )}
              {claim.currentOwners.length > 0 && (
                <Badge variant="destructive">Already managed by {claim.currentOwners.join(", ")}</Badge>
              )}
              <span className="text-xs text-muted-foreground">Filed {new Date(claim.createdAt).toLocaleString()}</span>
            </div>
            {claim.explanation && (
              <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-2">{claim.explanation}</p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={notes[claim.id] ?? ""}
                onChange={(event) => setNotes((current) => ({ ...current, [claim.id]: event.target.value }))}
                placeholder="Note to the claimant (optional)"
                maxLength={500}
                className="h-8 min-w-0 flex-1"
              />
              <Button size="sm" disabled={pending === claim.id} onClick={() => decide(claim, "approve")}>
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending === claim.id}
                onClick={() => decide(claim, "reject")}
              >
                Reject
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
