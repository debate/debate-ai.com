/**
 * Minimal ambient types for `extract-youtube`.
 *
 * The published package ships `dist/index.mjs` without declaration files, so
 * the transcript extractor declares just the surface it uses rather than
 * reaching into the dependency's TypeScript sources.
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

  /** Transcript client used by `src/youtube/extract-transcripts.ts`. */
  export class YouTubeTranscriptApi {
    constructor(...args: unknown[]);
    fetchTranscript(videoId: string): Promise<FetchedTranscript>;
  }
}
