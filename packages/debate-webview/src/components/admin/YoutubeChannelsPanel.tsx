"use client";

import { useEffect, useState } from "react";
import { Button } from "../../lib/ui/primitives/button";
import { Badge } from "../../lib/ui/primitives/badge";
import { Input } from "../../lib/ui/primitives/input";
import { Label } from "../../lib/ui/primitives/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../lib/ui/primitives/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../lib/ui/primitives/dialog";

/** One subscribed channel, as `/api/admin/youtube/channels` returns it. */
interface ChannelRow {
  id: number;
  channelId: string | null;
  name: string;
  enabled: boolean;
  addedBy: string | null;
  createdAt: string | number;
  updatedAt: string | number;
}

/** Formats a stored timestamp, which arrives as an ISO string or epoch seconds. */
function formatWhen(value: string | number | null): string {
  if (value === null || value === undefined) return "—";
  const date = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? "unknown" : date.toLocaleDateString();
}

/** The API's maximum page size, so most lists arrive in a single request. */
const PAGE_LIMIT = 200;

/** Fetches every subscribed channel, following the cursor until the list ends. */
async function fetchAllChannels(): Promise<ChannelRow[]> {
  const all: ChannelRow[] = [];
  let cursor: string | null = null;
  do {
    const params = new URLSearchParams({ limit: String(PAGE_LIMIT) });
    if (cursor) params.set("cursor", cursor);
    const res = await fetch(`/api/admin/youtube/channels?${params.toString()}`);
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error || `Request failed: ${res.status}`);
    all.push(...((body.channels ?? []) as ChannelRow[]));
    cursor = body.nextCursor ?? null;
  } while (cursor);
  return all;
}

/**
 * The admin "YouTube channels" section: the list of channels the weekly resync
 * scans for new debate rounds. Adding one subscribes the resync to it; toggling
 * "allowed in" on pauses a channel without losing it; removing it drops the
 * subscription and stops new rounds from that channel appearing at all.
 *
 * The full list is fetched once on mount. Adds, renames, toggles and removals
 * update the list in place from the API's response — nothing refetches.
 */
export function YoutubeChannelsPanel() {
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [addInput, setAddInput] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftName, setDraftName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [removing, setRemoving] = useState<ChannelRow | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAllChannels()
      .then((rows) => {
        if (!cancelled) setChannels(rows);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Puts a row returned by the API into the list, replacing any row with its id. */
  const upsertRow = (row: ChannelRow, { prepend = false }: { prepend?: boolean } = {}) => {
    setChannels((prev) => {
      if (prev.some((existing) => existing.id === row.id)) {
        return prev.map((existing) => (existing.id === row.id ? row : existing));
      }
      return prepend ? [row, ...prev] : [...prev, row];
    });
  };

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = addInput.trim();
    if (!name) return;
    setIsAdding(true);
    setAddError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/youtube/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "Could not add the channel");
      setNotice(`Added “${body.channel?.name ?? name}” to the subscribed channels.`);
      setAddInput("");
      if (body.channel) upsertRow(body.channel as ChannelRow, { prepend: true });
    } catch (err) {
      setAddError((err as Error).message);
    } finally {
      setIsAdding(false);
    }
  };

  const startEditing = (channel: ChannelRow) => {
    setEditingId(channel.id);
    setDraftName(channel.name);
    setSaveError(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setDraftName("");
    setSaveError(null);
  };

  const handleSave = async (channel: ChannelRow) => {
    const name = draftName.trim();
    if (!name || name === channel.name) {
      cancelEditing();
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/youtube/channels?id=${channel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "Could not rename the channel");
      setNotice(`Renamed “${channel.name}” to “${body.channel?.name ?? name}”.`);
      cancelEditing();
      if (body.channel) upsertRow(body.channel as ChannelRow);
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleEnabled = async (channel: ChannelRow) => {
    const next = !channel.enabled;
    setTogglingId(channel.id);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/youtube/channels?id=${channel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json"
        },
        body: JSON.stringify({ enabled: next }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "Could not update the channel");
      setNotice(
        next
          ? `${channel.name} is now allowed in.`
          : `${channel.name} is paused — its rounds won't be picked up.`,
      );
      setChannels((prev) =>
        prev.map((row) => (row.id === channel.id ? { ...row, enabled: next } : row)),
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setTogglingId(null);
    }
  };

  const handleRemove = async () => {
    if (!removing) return;
    setIsRemoving(true);
    setRemoveError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/youtube/channels?id=${removing.id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "Could not remove the channel");
      setNotice(`Removed “${removing.name}” — it will no longer be scanned.`);
      setChannels((prev) => prev.filter((row) => row.id !== removing.id));
      setRemoving(null);
    } catch (err) {
      setRemoveError((err as Error).message);
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscribed YouTube channels</CardTitle>
        <CardDescription>
          The channels the weekly resync scans for new debate rounds. A channel that is not
          "allowed in" is paused — kept here, but skipped by the scan so its rounds stop being
          picked up. Add a channel by its name or @handle; the resync resolves its YouTube id on
          the next run, so it does not need to be typed. Removing a channel unsubscribes the
          resync from it.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="channel-name">Channel name or @handle</Label>
            <Input
              id="channel-name"
              value={addInput}
              onChange={(event) => {
                setAddInput(event.target.value);
                setAddError(null);
              }}
              placeholder="e.g. KansasDebate-wd4vf"
              className="max-w-sm"
              disabled={isAdding}
              aria-label="Channel name or @handle"
            />
          </div>
          <Button type="submit" size="sm" disabled={isAdding || !addInput.trim()}>
            {isAdding ? "Adding…" : "Add channel"}
          </Button>
          {addError && <span className="text-destructive text-sm">{addError}</span>}
        </form>

        {(error || notice) && (
          <div className="flex flex-wrap items-center gap-3">
            {error && <span className="text-destructive text-sm">{error}</span>}
            {notice && <span className="text-muted-foreground text-sm">{notice}</span>}
          </div>
        )}

        <ul className="divide-y rounded-md border text-sm">
          {channels.map((channel) => {
            const isEditing = editingId === channel.id;
            const isToggling = togglingId === channel.id;
            const isPending = isSaving || isToggling || removing?.id === channel.id;
            return (
              <li key={channel.id} className="flex flex-wrap items-center gap-3 p-3">
                <label className="flex items-center gap-2" title={channel.enabled ? "Allowed in" : "Paused"}>
                  <input
                    type="checkbox"
                    checked={channel.enabled}
                    disabled={isPending || isEditing}
                    onChange={() => toggleEnabled(channel)}
                    aria-label={channel.enabled ? "Pause channel" : "Allow channel in"}
                  />
                  <span className="text-xs text-muted-foreground">allowed in</span>
                </label>

                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <Input
                      value={draftName}
                      onChange={(event) => setDraftName(event.target.value)}
                      disabled={isSaving}
                      aria-label="Channel name"
                    />
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">
                        {channel.name || <span className="text-muted-foreground">—</span>}
                      </span>
                      {!channel.enabled && (
                        <Badge variant="secondary" className="font-normal">
                          paused
                        </Badge>
                      )}
                      {channel.channelId && (
                        <span className="text-muted-foreground" title="YouTube channel id">
                          ({channel.channelId})
                        </span>
                      )}
                    </div>
                  )}
                  {isEditing && saveError && (
                    <p className="text-destructive text-xs">{saveError}</p>
                  )}
                  <p className="text-muted-foreground truncate text-xs">
                    {channel.addedBy ? `added by ${channel.addedBy} · ` : ""}
                    updated {formatWhen(channel.updatedAt)}
                    {channel.createdAt !== channel.updatedAt &&
                      ` · added ${formatWhen(channel.createdAt)}`}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {isEditing ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => cancelEditing()}
                        disabled={isSaving}
                      >
                        Cancel
                      </Button>
                      <Button size="sm" onClick={() => handleSave(channel)} disabled={isSaving || !draftName.trim()}>
                        {isSaving ? "Saving…" : "Save"}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={() => startEditing(channel)} disabled={isPending}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRemoving(channel)}
                        disabled={isPending}
                      >
                        Remove
                      </Button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
          {channels.length === 0 && (
            <li className="text-muted-foreground p-3 text-center text-sm">
              {isLoading ? "Loading channels…" : "No subscribed channels yet."}
            </li>
          )}
        </ul>
      </CardContent>

      <Dialog
        open={!!removing}
        onOpenChange={(open) => (open ? undefined : setRemoving(null))}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove this channel?</DialogTitle>
            <DialogDescription>
              “{removing?.name}” will be removed from the subscribed list. The resync will stop
              scanning it, so no new rounds from it will appear. Removing a channel is not the
              same as pausing it — use the "allowed in" checkbox to stop a channel temporarily and
              bring it back later.
            </DialogDescription>
          </DialogHeader>
          {removeError && <p className="text-destructive text-sm">{removeError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(null)} disabled={isRemoving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemove} disabled={isRemoving}>
              {isRemoving ? "Removing…" : "Remove channel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
