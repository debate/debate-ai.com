"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "../ui/primitives/button";
import { Badge } from "../ui/primitives/badge";
import { Input } from "../ui/primitives/input";
import { Label } from "../ui/primitives/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/primitives/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/primitives/dialog";

/** A channel's newest known video. */
interface LatestVideo {
  videoId: string;
  title: string;
  publishedAt: string;
}

/** One subscribed channel, as `/api/admin/youtube/channels` returns it. */
interface ChannelRow {
  id: number;
  channelId: string | null;
  name: string;
  title?: string | null;
  enabled: boolean;
  addedBy: string | null;
  createdAt: string | number;
  updatedAt: string | number;
  /** Absent on add/edit responses, which return the bare row. */
  videoCount?: number;
  latestVideo?: LatestVideo | null;
  /** No upload in the last year — listed under "Defunct channels". Absent on add/edit responses. */
  defunct?: boolean;
  /** Newest upload (YYYY-MM-DD) a scan has seen on the channel, round or not. */
  lastUploadAt?: string | null;
  /** When a scan last walked the channel. */
  lastCheckedAt?: string | number | null;
}

/** What `POST /api/admin/youtube/resync` answers with on success. */
interface ResyncResult {
  channelsSynced: number;
  videosUpserted: number;
}

/** Runs a resync limited to `body` (a scope or one channel) and returns its tally. */
async function runResync(body: Record<string, unknown>): Promise<ResyncResult> {
  const res = await fetch("/api/admin/youtube/resync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.details || data?.error || `Request failed: ${res.status}`);
  return { channelsSynced: Number(data.channelsSynced) || 0, videosUpserted: Number(data.videosUpserted) || 0 };
}

/** "1 new round" / "3 new rounds". */
function roundsLabel(count: number): string {
  return `${count} new round${count === 1 ? "" : "s"}`;
}

/** Formats a stored timestamp, which arrives as an ISO string or epoch seconds. */
function formatWhen(value: string | number | null): string {
  if (value === null || value === undefined) return "—";
  const date = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? "unknown" : date.toLocaleDateString();
}

/** Most videos first, ties by name — the order the API sends. */
function byVideoCount(a: ChannelRow, b: ChannelRow): number {
  return (b.videoCount ?? 0) - (a.videoCount ?? 0) || a.name.localeCompare(b.name);
}

/** Fetches every subscribed channel. The API sends the whole list in one response. */
async function fetchAllChannels(): Promise<ChannelRow[]> {
  const res = await fetch("/api/admin/youtube/channels");
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error || `Request failed: ${res.status}`);
  return (body.channels ?? []) as ChannelRow[];
}

/**
 * The admin "YouTube channels" section: the list of channels the weekly resync
 * scans for new debate rounds. Adding one subscribes the resync to it; toggling
 * "allowed in" on pauses a channel without losing it; removing it drops the
 * subscription and stops new rounds from that channel appearing at all.
 *
 * Shown as a table, most videos first, with each channel's newest video.
 * Channels with no upload in the last year sit in a "Defunct channels" table
 * below: the daily scan skips them (they are scanned on Mondays only), and a
 * button checks them all on demand. Every row also has a "Check" button that
 * scans just that channel. The full list is fetched once on mount and again
 * after a check, since a check can move a channel between the two tables.
 * Adds, renames, toggles and removals update the list in place from the
 * API's response.
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
  const [checkingId, setCheckingId] = useState<number | null>(null);
  const [isCheckingDefunct, setIsCheckingDefunct] = useState(false);

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

  const sortedChannels = useMemo(() => [...channels].sort(byVideoCount), [channels]);
  const activeChannels = useMemo(() => sortedChannels.filter((row) => !row.defunct), [sortedChannels]);
  const defunctChannels = useMemo(() => sortedChannels.filter((row) => row.defunct), [sortedChannels]);

  /** Reloads the list after a check, which can move channels between sections. */
  const reloadChannels = async () => {
    setChannels(await fetchAllChannels());
  };

  /** Scans one channel for new videos. */
  const checkChannel = async (channel: ChannelRow) => {
    setCheckingId(channel.id);
    setNotice(null);
    setError(null);
    try {
      const result = await runResync({ channelId: channel.id });
      await reloadChannels();
      setNotice(
        result.channelsSynced === 0
          ? `Couldn't find “${channel.name}” on YouTube — check the name or @handle.`
          : `Checked ${channel.name}: ${roundsLabel(result.videosUpserted)} added to the queue.`,
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCheckingId(null);
    }
  };

  /** Scans every defunct channel for new videos. */
  const checkDefunctChannels = async () => {
    setIsCheckingDefunct(true);
    setNotice(null);
    setError(null);
    try {
      const result = await runResync({ scope: "defunct" });
      await reloadChannels();
      setNotice(
        `Checked ${result.channelsSynced} defunct channel${result.channelsSynced === 1 ? "" : "s"}: ` +
          `${roundsLabel(result.videosUpserted)} added to the queue.`,
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsCheckingDefunct(false);
    }
  };

  /** Puts a row returned by the API into the list, merging into any row with its id
   *  so the video count and newest video it already had are kept. */
  const upsertRow = (row: ChannelRow) => {
    setChannels((prev) => {
      if (prev.some((existing) => existing.id === row.id)) {
        return prev.map((existing) => (existing.id === row.id ? { ...existing, ...row } : existing));
      }
      return [...prev, row];
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
      if (body.channel) upsertRow(body.channel as ChannelRow);
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

  /** One channels table: the active list, or the defunct one below it. */
  const renderTable = (rows: ChannelRow[], emptyText: string) => (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
          <tr>
            <th className="p-3 font-medium">Allowed in</th>
            <th className="p-3 font-medium">Channel</th>
            <th className="p-3 text-right font-medium">Videos</th>
            <th className="p-3 font-medium">Most recent video</th>
            <th className="p-3 text-right font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((channel) => {
            const isEditing = editingId === channel.id;
            const isToggling = togglingId === channel.id;
            const isChecking = checkingId === channel.id;
            const isPending = isSaving || isToggling || isChecking || removing?.id === channel.id;
            const latest = channel.latestVideo;
            return (
              <tr key={channel.id} className="align-top">
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={channel.enabled}
                    disabled={isPending || isEditing}
                    onChange={() => toggleEnabled(channel)}
                    title={channel.enabled ? "Allowed in" : "Paused"}
                    aria-label={channel.enabled ? "Pause channel" : "Allow channel in"}
                  />
                </td>

                <td className="min-w-48 p-3">
                  {isEditing ? (
                    <Input
                      value={draftName}
                      onChange={(event) => setDraftName(event.target.value)}
                      disabled={isSaving}
                      aria-label="Channel name"
                    />
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5">
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
                  <p className="text-muted-foreground text-xs">
                    {channel.title && channel.title !== channel.name ? `${channel.title} · ` : ""}
                    {channel.addedBy ? `added by ${channel.addedBy} · ` : ""}
                    updated {formatWhen(channel.updatedAt)}
                    {channel.createdAt !== channel.updatedAt &&
                      ` · added ${formatWhen(channel.createdAt)}`}
                  </p>
                </td>

                <td className="p-3 text-right tabular-nums">{channel.videoCount ?? 0}</td>

                <td className="min-w-56 p-3">
                  {latest ? (
                    <>
                      <a
                        href={`https://www.youtube.com/watch?v=${latest.videoId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="line-clamp-2 hover:underline"
                      >
                        {latest.title || latest.videoId}
                      </a>
                      <p className="text-muted-foreground text-xs">{formatWhen(latest.publishedAt)}</p>
                    </>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                  {channel.lastUploadAt && channel.lastUploadAt !== latest?.publishedAt && (
                    <p className="text-muted-foreground text-xs">
                      last upload {formatWhen(channel.lastUploadAt)}
                    </p>
                  )}
                </td>

                <td className="p-3">
                  <div className="flex justify-end gap-2">
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
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => checkChannel(channel)}
                          disabled={isPending || checkingId !== null || isCheckingDefunct}
                          title="Scan just this channel for new videos"
                        >
                          {isChecking ? "Checking…" : "Check"}
                        </Button>
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
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="text-muted-foreground p-3 text-center text-sm">
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscribed YouTube channels</CardTitle>
        <CardDescription>
          The channels the daily scan checks for new debate rounds. A channel that is not
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

        {renderTable(activeChannels, isLoading ? "Loading channels…" : "No subscribed channels yet.")}

        {!isLoading && (
          <div className="flex flex-col gap-3 pt-2">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="font-semibold">Defunct channels</h3>
                <p className="text-muted-foreground text-sm">
                  No new videos in the last year. The daily scan skips these and checks them on
                  Mondays only; a channel moves back up as soon as a check finds a new upload.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={checkDefunctChannels}
                disabled={isCheckingDefunct || checkingId !== null || defunctChannels.length === 0}
              >
                {isCheckingDefunct ? "Checking…" : "Check defunct channels for new videos"}
              </Button>
            </div>
            {renderTable(defunctChannels, "No defunct channels.")}
          </div>
        )}
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
