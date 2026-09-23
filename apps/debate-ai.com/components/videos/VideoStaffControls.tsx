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
 * "Edit video" and "Transcripts" buttons on a watch page, shown only to
 * admins and moderators. The role is fetched client-side from
 * `/api/admin/me` so the public page itself stays cacheable; the edit routes
 * re-check the role on every request, so hiding the buttons is UX, not
 * access control.
 */
export function VideoStaffControls({ videoId }: { videoId: string }) {
  const router = useRouter();
  const [canEdit, setCanEdit] = useState(false);
  const [editing, setEditing] = useState<LibraryVideo | null>(null);
  const [contentVideo, setContentVideo] = useState<ContentDialogVideo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  if (!canEdit) return null;

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
        size="sm"
        variant="outline"
        onClick={openEditor}
        disabled={isLoading}
        title={error ?? "Edit this video's metadata"}
      >
        <Pencil />
        Edit video
      </Button>
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
      {error && <span className="text-destructive text-xs">{error}</span>}

      <VideoEditDialog
        video={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          // Re-render the page from the server; a changed title or tournament
          // moves the canonical URL, and the page redirects to it.
          router.refresh();
        }}
      />
      <VideoContentDialog
        video={contentVideo}
        onOpenChange={(open) => (open ? undefined : setContentVideo(null))}
        onSaved={() => router.refresh()}
      />
    </>
  );
}
