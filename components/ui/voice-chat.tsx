"use client"

import { useState } from "react"
import { ChevronDown, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface Participant {
  id: string
  name: string
  avatar: string
}

const COLLAPSED_WIDTH = 268
const EXPANDED_WIDTH = 360
const EXPANDED_HEIGHT = 420

const AVATAR_SIZE_COLLAPSED = 44
const AVATAR_SIZE_EXPANDED = 56
const AVATAR_OVERLAP = -12

function getAvatarPosition(index: number, isExpanded: boolean) {
  if (!isExpanded) {
    const startX = 60
    return {
      x: startX + index * (AVATAR_SIZE_COLLAPSED + AVATAR_OVERLAP),
      y: 8,
      size: AVATAR_SIZE_COLLAPSED,
      opacity: index < 4 ? 1 : 0,
      scale: 1,
    }
  } else {
    const gridStartX = 28
    const gridStartY = 70
    const colWidth = 80
    const rowHeight = 95

    let col: number
    let row: number

    if (index < 4) {
      col = index
      row = 0
    } else {
      col = index - 4
      row = 1
    }

    return {
      x: gridStartX + col * colWidth,
      y: gridStartY + row * rowHeight,
      size: AVATAR_SIZE_EXPANDED,
      opacity: 1,
      scale: 1,
    }
  }
}

export function VoiceChat({ participants }: { participants: Participant[] }) {
  const [isExpanded, setIsExpanded] = useState(false)

  const visibleCount = Math.min(participants.length, 4)
  const hiddenCount = Math.max(0, participants.length - 4)

  return (
    <>
      <div
        onClick={() => !isExpanded && setIsExpanded(true)}
        className={cn(
          "relative bg-background shadow-xl shadow-black/10 border border-border overflow-hidden",
          "transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
          !isExpanded && "cursor-pointer hover:shadow-2xl hover:shadow-black/15",
        )}
        style={{
          width: isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
          height: isExpanded ? EXPANDED_HEIGHT : 60,
          borderRadius: isExpanded ? 24 : 999,
        }}
      >
        {/* Counter (collapsed only) */}
        {hiddenCount > 0 && (
          <div
            className={cn(
              "absolute flex items-center gap-0.5 text-muted-foreground",
              "transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
              isExpanded ? "opacity-0 pointer-events-none" : "opacity-100",
            )}
            style={{
              right: 16,
              top: "50%",
              transform: "translateY(-50%)",
            }}
          >
            <span className="text-md font-medium">+{hiddenCount}</span>
            <ChevronDown className="w-4 h-4" />
          </div>
        )}

        {/* Header (expanded only) */}
        <div
          className={cn(
            "absolute inset-x-0 top-0 flex items-center justify-between px-5 pt-4 pb-3",
            "transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
            isExpanded ? "opacity-100" : "opacity-0 pointer-events-none",
          )}
          style={{ transitionDelay: isExpanded ? "100ms" : "0ms" }}
        >
          <div className="w-8" />
          <h2 className="text-[15px] font-semibold text-foreground">Voice Chat</h2>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsExpanded(false)
            }}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Divider */}
        <div
          className={cn(
            "absolute left-4 right-4 h-px bg-border",
            "transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
            isExpanded ? "opacity-100" : "opacity-0",
          )}
          style={{ top: 52 }}
        />

        {participants.map((participant, index) => {
          const pos = getAvatarPosition(index, isExpanded)
          const delay = isExpanded ? index * 30 : (Math.min(participants.length, 4) - 1 - index) * 20

          return (
            <div
              key={participant.id}
              className="absolute transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
              style={{
                left: pos.x,
                top: pos.y,
                width: pos.size,
                height: isExpanded ? pos.size + 28 : pos.size,
                opacity: pos.opacity,
                zIndex: isExpanded ? 1 : 4 - index,
                transitionDelay: `${delay}ms`,
              }}
            >
              <div className="relative flex flex-col items-center">
                <div
                  className="rounded-full overflow-hidden ring-[2.5px] ring-background shadow-sm transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
                  style={{
                    width: pos.size,
                    height: pos.size,
                  }}
                >
                  <img
                    src={participant.avatar || "/placeholder.svg?height=56&width=56"}
                    alt={participant.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Name - only visible when expanded */}
                <span
                  className={cn(
                    "absolute text-[13px] font-medium text-muted-foreground whitespace-nowrap",
                    "transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
                    isExpanded ? "opacity-100" : "opacity-0",
                  )}
                  style={{
                    top: pos.size + 8,
                    transitionDelay: isExpanded ? `${150 + index * 30}ms` : "0ms",
                  }}
                >
                  {participant.name}
                </span>
              </div>
            </div>
          )
        })}

        {/* Join Button */}
        <button
          className={cn(
            "absolute left-4 right-4 bg-foreground text-background py-3.5 rounded-2xl font-medium text-[15px]",
            "shadow-lg shadow-foreground/20 hover:opacity-90 active:scale-[0.98]",
            "transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
            isExpanded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none",
          )}
          style={{ bottom: 50, transitionDelay: isExpanded ? "200ms" : "0ms" }}
        >
          Join Now
        </button>

        {/* Helper Text */}
        <p
          className={cn(
            "absolute inset-x-0 text-center text-[13px] text-muted-foreground",
            "transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
            isExpanded ? "opacity-100" : "opacity-0",
          )}
          style={{ bottom: 16, transitionDelay: isExpanded ? "250ms" : "0ms" }}
        >
          Mic will be muted initially.
        </p>
      </div>
    </>
  )
}
