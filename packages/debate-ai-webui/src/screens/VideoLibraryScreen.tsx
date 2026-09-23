/**
 * @fileoverview The video archive — the app's `/videos` landing surface.
 *
 * One page of the library at a time, filtered and sorted server-side through
 * `listVideos`, because the archive is thousands of rows and the route is
 * built to page rather than to dump. Rows arrive as positional tuples; see
 * `../videos.ts` for why, and for the decoding.
 *
 * @module screens/VideoLibraryScreen
 */

import { useState } from "react";
import { listVideos } from "debate-api-client";

import { unwrap } from "../api";
import { AsyncBoundary, Card, ResultCount, SearchField, SelectField } from "../primitives";
import { useAsync, useDebounced } from "../useAsync";
import {
  decodeVideoRows,
  formatViewCount,
  styleLabel,
  videoWatchUrl,
  type VideoRow,
} from "../videos";
import type { WebUIContext } from "../types";

/** Page size — small enough to stay readable inside an extension Options tab. */
const PAGE_SIZE = 24;

const SOURCES = [
  { value: "all", label: "Rounds and lectures" },
  { value: "round", label: "Rounds only" },
  { value: "lecture", label: "Lectures only" },
] as const;

const SORTS = [
  { value: "Recency", label: "Newest first" },
  { value: "Views", label: "Most viewed" },
] as const;

interface VideoPage {
  videos: VideoRow[];
  total: number;
}

export function VideoLibraryScreen({ client, openRoute }: WebUIContext) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<string>("all");
  const [sort, setSort] = useState<string>("Recency");
  const debouncedQuery = useDebounced(query);

  const { data, loading, error, reload } = useAsync<VideoPage>(
    async () => {
      const payload = await unwrap(
        listVideos(
          {
            query: {
              q: debouncedQuery || undefined,
              source: source as "all" | "round" | "lecture",
              sort: sort as "Recency" | "Views",
              limit: PAGE_SIZE,
            },
          },
          { client },
        ),
      );
      return {
        videos: decodeVideoRows(payload.videos),
        total: Number(payload.total) || 0,
      };
    },
    [debouncedQuery, source, sort],
  );

  const videos = data?.videos ?? [];

  return (
    <>
      <div className="dai-filters">
        <SearchField
          id="dai-videos-q"
          label="Search the archive"
          placeholder="Topic, school, channel…"
          value={query}
          onChange={setQuery}
        />
        <SelectField
          id="dai-videos-source"
          label="Show"
          value={source}
          options={SOURCES}
          onChange={setSource}
        />
        <SelectField
          id="dai-videos-sort"
          label="Sort by"
          value={sort}
          options={SORTS}
          onChange={setSort}
        />
      </div>

      {data && <ResultCount count={data.total} noun="video" />}

      <AsyncBoundary
        loading={loading}
        error={error}
        empty={videos.length === 0}
        emptyText="No videos match those filters."
        onRetry={reload}
      >
        <div className="dai-list">
          {videos.map((video) => (
            <Card
              key={video.videoId}
              title={video.title || "Untitled"}
              href={videoWatchUrl(video)}
              subtitle={video.channel}
              meta={[
                styleLabel(video.style),
                video.tournament,
                video.date ? video.date.slice(0, 10) : undefined,
                `${formatViewCount(video.viewCount)} views`,
                video.isTopPick ? "Top pick" : undefined,
              ]}
            />
          ))}
        </div>
      </AsyncBoundary>

      <p className="dai-footnote">
        This is the first {PAGE_SIZE} of the matching videos.{" "}
        <button type="button" className="dai-link" onClick={() => openRoute("/videos")}>
          Open the full archive
        </button>
        .
      </p>
    </>
  );
}
