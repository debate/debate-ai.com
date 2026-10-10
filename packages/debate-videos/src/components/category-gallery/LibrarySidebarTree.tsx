/**
 * @fileoverview The video library's sidebar tree, for pages that are not in
 * the video library.
 *
 * The app has one sidebar: the one the video pages draw — Round Videos,
 * Lectures, then the Research / Practice / Coaching / Insights
 * tool sections (`VideoSidebarTree`). The library pages feed that tree from
 * their own feed state; every other page (the tool pages, /docs, the mobile
 * drawer) mounts it through this wrapper, which reads the same counts and
 * lecture categories itself (`useVideoMeta`, cached, so it costs one request
 * at most) and keeps the Lectures section's open state locally, starting
 * closed so the tool sections stay in view.
 *
 * @module components/category-gallery/LibrarySidebarTree
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useVideoMeta } from "../../hooks/useVideoFeed";
import { useWatchHistory } from "../../hooks/useWatchHistory";
import { listVideoFavorites } from "../../state/videoLibrary";
import { VideoSidebarTree } from "./VideoSidebarTree";
import { SIDEBAR_VIDEO_LINKS } from "./sidebar-video-links";

export function LibrarySidebarTree() {
  const pathname = usePathname();
  const { counts, lectureCategories } = useVideoMeta();
  const watchHistory = useWatchHistory();
  const [lecturesExpanded, setLecturesExpanded] = useState(false);

  // Read after mount so the server markup and the first client render agree,
  // and again on navigation: favouriting happens on the video pages.
  const [favoriteCount, setFavoriteCount] = useState(0);
  useEffect(() => {
    try {
      setFavoriteCount(listVideoFavorites().length);
    } catch {
      setFavoriteCount(0);
    }
  }, [pathname]);

  const quickLinkCounts = useMemo(
    () =>
      ({
        allVideos: counts.total,
        lectures: counts.lectures,
        policy: counts.byStyle[1] ?? 0,
        ld: counts.byStyle[3] ?? 0,
        pf: counts.byStyle[2] ?? 0,
        college: counts.byStyle[4] ?? 0,
        topPicks: counts.topPicks,
        favorites: favoriteCount,
        history: watchHistory.size,
      }) as Record<string, number>,
    [counts, favoriteCount, watchHistory],
  );

  // A library row lights up only when this page is that row's own href.
  const activeId = SIDEBAR_VIDEO_LINKS.find((link) => link.href === pathname)?.id;

  return (
    <VideoSidebarTree
      counts={quickLinkCounts}
      lectureCategories={lectureCategories}
      activeId={activeId}
      lecturesExpanded={lecturesExpanded}
      onToggleLectures={() => setLecturesExpanded((open) => !open)}
    />
  );
}
