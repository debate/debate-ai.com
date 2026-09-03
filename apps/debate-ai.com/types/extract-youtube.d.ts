/**
 * Minimal ambient types for `extract-youtube`.
 *
 * The published package ships `dist/index.mjs` without declaration files, so
 * this declares just the surface used by `app/api/transcript/route.ts`
 * rather than reaching into the dependency's TypeScript sources. Mirrors
 * `packages/debate-data-sync/src/types/extract-youtube.d.ts`.
 */
declare module "extract-youtube" {
  /** One timed caption line of a fetched transcript. */
  export interface TranscriptSnippet {
    text: string;
    start: number;
    duration: number;
  }

  /** A fetched transcript for a single video. */
  export interface FetchedTranscript {
    snippets: TranscriptSnippet[];
  }

  /** Transcript client used by the transcript API route. */
  export class YouTubeTranscriptApi {
    constructor(...args: unknown[]);
    fetchTranscript(videoId: string): Promise<FetchedTranscript>;
  }
}
