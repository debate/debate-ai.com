"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Pencil } from "lucide-react";
import { Button } from "../../lib/ui/primitives/button";
import { VideoContentDialog, type ContentDialogVideo } from "../admin/VideoContentDialog";
import { VideoEditDialog, type LibraryVideo } from "../admin/VideoEditDialog";

interface StaffRoleResponse {
  canEditContent?: boolean;
}

/**
 * The icon-only edit button on a watch page, plus "Transcripts" for staff.
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
  const [contentVideo, setContentVideo] = useState<ContentDialogVideo | null>(null);
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

  const openContent = async () => {
    const video = await loadVideo();
    if (video) {
      setContentVideo({
        videoId: video.videoId,
        title: video.title,
        channel: video.channel,
        tournament: video.tournament,
      });
    }
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
      {canEdit && (
        <Button
          size="sm"
          variant="outline"
          onClick={openContent}
          disabled={isLoading}
          title="Edit transcripts, summary and linked videos"
        >
          <FileText />
          Transcripts
        </Button>
      )}
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
        onSaved={() => {
          setEditing(null);
          // Re-render the page from the server; a changed title or tournament
          // moves the canonical URL, and the page redirects to it.
          router.refresh();
        }}
      />
      {canEdit && (
        <VideoContentDialog
          video={contentVideo}
          onOpenChange={(open) => (open ? undefined : setContentVideo(null))}
          onSaved={() => router.refresh()}
        />
      )}
    </>
  );
}
