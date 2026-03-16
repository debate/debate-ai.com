import type { VideoMeta } from "@/lib/state/videoPlayerStore"
import { useVideoPlayerStore } from "@/lib/state/videoPlayerStore"
import { STYLE_COLORS, DEBATE_STYLE_LABELS } from "../video-card/videoCardUtils"

interface PlayerTitleBarProps {
  activeVideoMeta: VideoMeta | null
  activeVideoTitle: string | null
}

export function PlayerTitleBar({ activeVideoMeta, activeVideoTitle }: PlayerTitleBarProps) {
  const searchHandler = useVideoPlayerStore((state) => state.searchHandler)
  return (
    <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden">
      {activeVideoMeta?.style && DEBATE_STYLE_LABELS[activeVideoMeta.style as keyof typeof DEBATE_STYLE_LABELS] ? (
        <span className={`inline-flex items-center px-1 py-0 rounded text-[8px] uppercase tracking-wide leading-tight shrink-0 ${STYLE_COLORS[activeVideoMeta.style] ?? "bg-muted text-muted-foreground"}`}>
          {DEBATE_STYLE_LABELS[activeVideoMeta.style as keyof typeof DEBATE_STYLE_LABELS]}
        </span>
      ) : null}
      {activeVideoMeta?.year ? (
        <span className="inline-flex items-center px-1 py-0 rounded text-[8px] font-bold border border-orange-200 bg-orange-100 text-orange-700 dark:border-orange-800 dark:bg-orange-900/40 dark:text-orange-300 leading-tight shrink-0">
          &apos;{String(activeVideoMeta.year).slice(-2)}
        </span>
      ) : null}
      {activeVideoMeta?.tournament ? (
        <button
          onClick={() => searchHandler?.(activeVideoMeta.tournament?.replace(/\d+/g, '').trim() || '')}
          className="text-[10px] font-bold text-purple-600 dark:text-purple-400 [font-variant:small-caps] tracking-wider truncate shrink-0 max-w-[80px] hover:underline cursor-pointer"
        >
          {activeVideoMeta.tournament.replace(/\d+/g, '').trim()}
        </button>
      ) : null}
      {activeVideoMeta?.affTeam ? (
        <button
          onClick={() => searchHandler?.(activeVideoMeta.affTeam || '')}
          className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 shrink-0 hover:underline cursor-pointer"
        >
          {activeVideoMeta.affTeam}
        </button>
      ) : null}
      {activeVideoMeta?.negTeam ? (
        <button
          onClick={() => searchHandler?.(activeVideoMeta.negTeam || '')}
          className="text-[10px] font-semibold text-red-600 dark:text-red-400 shrink-0 hover:underline cursor-pointer"
        >
          {activeVideoMeta.negTeam}
        </button>
      ) : null}
      {!activeVideoMeta?.style && !activeVideoMeta?.tournament && (
        <span className="text-xs font-medium text-foreground truncate">
          {activeVideoTitle ?? "Playing video"}
        </span>
      )}
    </div>
  )
}
