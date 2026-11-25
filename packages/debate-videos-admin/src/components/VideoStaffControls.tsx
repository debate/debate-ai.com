"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "../ui/primitives/button";
import { VideoEditDialog, type LibraryVideo } from "./VideoEditDialog";
import { movedWatchPagePath } from "../lib/moved-watch-page";

interface StaffRoleResponse {
  canEditContent?: boolean;
}

/**
 * The icon-only edit button on a watch page.
 *
 * Everyone sees the edit button. Admins and moderators save straight to the
 * library; anyone else gets the same form in suggest mode, which files their
 * changes (or a deletion request) for a moderator to approve. The role is
 * fetched client-side from `/api/admin/me` so the public page itself stays
 * cacheable; the edit routes re-check it on every request, so the mode is UX,
 * not access control.
 */
export function VideoStaffControls({ videoId }: { videoId: string }) {
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
