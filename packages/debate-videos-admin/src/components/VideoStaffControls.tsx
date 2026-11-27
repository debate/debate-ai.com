"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { DEBATE_STYLE_LABELS, DEBATE_STYLE_ORDER } from "@debate-ai/videos/src/types/videos";
import { Button } from "../ui/primitives/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/primitives/select";
import { VideoEditDialog, type LibraryVideo } from "./VideoEditDialog";
import { movedWatchPagePath } from "../lib/moved-watch-page";

interface StaffRoleResponse {
  canEditContent?: boolean;
}

/** Select value for a demo whose format is left to the title's guess. */
const AUTO_DEMO_STYLE = "auto";

/**
 * Staff-only dropdown on a demo debate's watch page: which debate format the
 * demo shows (PF, Policy, LD...). The format is what gives the page the round
 * experience — speech detection and the speech timeline — so changing it
 * saves to the library and re-renders the page. "Guess from title" clears the
 * pick.
 */
function DemoFormatSelect({ videoId, onSaved }: { videoId: string; onSaved: () => void }) {
  const [value, setValue] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/videos/library/${encodeURIComponent(videoId)}`)
      .then((res) => (res.ok ? (res.json() as Promise<{ video?: { demoStyle?: number | null } }>) : null))
      .then((body) => {
        if (cancelled || !body?.video) return;
        const stored = body.video.demoStyle;
        setValue(stored == null ? AUTO_DEMO_STYLE : String(stored));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  const save = async (next: string) => {
    const previous = value;
    setValue(next);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/videos/library/${encodeURIComponent(videoId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demoStyle: next === AUTO_DEMO_STYLE ? null : Number(next) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.details || body?.error || "Could not save the demo format");
      onSaved();
    } catch (err) {
      setValue(previous);
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (value === null) return null;
  return (
    <>
      <Select value={value} onValueChange={save} disabled={saving}>
        <SelectTrigger className="h-8 w-[9.5rem]" aria-label="Demo debate format" title="Which debate format this demo shows">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={AUTO_DEMO_STYLE}>Guess from title</SelectItem>
          {DEBATE_STYLE_ORDER.map((style) => (
            <SelectItem key={style} value={String(style)}>
              {DEBATE_STYLE_LABELS[style]} demo
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <span className="text-destructive text-xs">{error}</span>}
    </>
  );
}

/**
 * The icon-only edit button on a watch page. For staff the form also carries
 * the "Transcripts & related videos" section.
 *
 * Everyone sees the edit button. Admins and moderators save straight to the
 * library; anyone else gets the same form in suggest mode, which files their
 * changes (or a deletion request) for a moderator to approve. The role is
 * fetched client-side from `/api/admin/me` so the public page itself stays
 * cacheable; the edit routes re-check it on every request, so the mode is UX,
 * not access control.
 *
 * On a demo debate (`isDemo`) staff also get the format dropdown.
 */
export function VideoStaffControls({ videoId, isDemo = false }: { videoId: string; isDemo?: boolean }) {
  const router = useRouter();
  const [canEdit, setCanEdit] = useState(false);
  const [editing, setEditing] = useState<LibraryVideo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/me")
      .then((res) => (res.ok ? (res.json() as Promise<StaffRoleResponse>) : null))
      .then((data) => {
        if (!cancelled) setCanEdit(!!data?.canEditContent);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  /** Loads the editable row fresh, so the form never starts from stale props. */
  const loadVideo = async (): Promise<LibraryVideo | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/videos/library/${encodeURIComponent(videoId)}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.details || body?.error || "Could not load video");
      return body.video as LibraryVideo;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const openEditor = async () => {
    setNotice(null);
    const video = await loadVideo();
    if (video) setEditing(video);
  };

  return (
    <>
      {isDemo && canEdit && <DemoFormatSelect videoId={videoId} onSaved={() => router.refresh()} />}
      <Button
        size="icon"
        variant="outline"
        className="size-8"
        onClick={openEditor}
        disabled={isLoading}
        title={error ?? (canEdit ? "Edit this video" : "Suggest an edit to this video")}
        aria-label={canEdit ? "Edit this video" : "Suggest an edit to this video"}
      >
        <Pencil />
      </Button>
      {error && <span className="text-destructive text-xs">{error}</span>}
      {notice && <span className="text-muted-foreground text-xs">{notice}</span>}

      <VideoEditDialog
        video={editing}
        mode={canEdit ? "staff" : "suggest"}
        onSubmitted={(message) => {
          setEditing(null);
          setNotice(message);
        }}
        onClose={() => setEditing(null)}
        onContentSaved={() => router.refresh()}
        onDeleted={() => {
          // The watch page no longer resolves once the video is gone.
          setEditing(null);
          router.replace("/videos");
        }}
        onSaved={(_video, paths) => {
          setEditing(null);
          // A corrected title, tournament, round or team name moves the
          // video's address, and the old one may no longer resolve, so go
          // straight to the new one (keeping the open speech and view).
          // Otherwise re-render the page in place from the server.
          const next = paths && movedWatchPagePath(window.location.pathname, paths.previousHref, paths.href);
          if (next) router.replace(`${next}${window.location.search}${window.location.hash}`);
          else router.refresh();
        }}
      />
    </>
  );
}
