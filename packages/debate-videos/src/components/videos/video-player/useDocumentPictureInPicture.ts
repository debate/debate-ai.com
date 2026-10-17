/**
 * @fileoverview Hook that pops a DOM node into a floating always-on-top
 * window via the Document Picture-in-Picture API. The node is physically
 * moved (not cloned). Browsers reload an iframe when it changes document, so
 * callers that host a YouTube embed record the playback time before toggling
 * and resume from it (see `buildEmbedUrl`'s `startSeconds`).
 */

import { useCallback, useEffect, useRef, useState } from "react"

interface DocumentPictureInPicture {
  window: Window | null
  requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>
}

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture
  }
}

/** Copy the host page's stylesheets into the PiP window so Tailwind classes still render */
function copyStyles(pipWindow: Window) {
  Array.from(document.styleSheets).forEach((styleSheet) => {
    try {
      const rules = Array.from(styleSheet.cssRules).map((rule) => rule.cssText).join("")
      const style = pipWindow.document.createElement("style")
      style.textContent = rules
      pipWindow.document.head.appendChild(style)
    } catch {
      // Cross-origin stylesheets throw on cssRules access — link them instead
      if (styleSheet.href) {
        const link = pipWindow.document.createElement("link")
        link.rel = "stylesheet"
        link.href = styleSheet.href
        pipWindow.document.head.appendChild(link)
      }
    }
  })
}

export function useDocumentPictureInPicture(nodeRef: React.RefObject<HTMLElement | null>) {
  const [isSupported, setIsSupported] = useState(false)
  const [isActive, setIsActive] = useState(false)
  // Comment node left behind in the original spot so the moved node can return to the right place
  const anchorRef = useRef<Comment | null>(null)

  useEffect(() => {
    setIsSupported(typeof window !== "undefined" && "documentPictureInPicture" in window)
  }, [])

  const restoreNode = useCallback(() => {
    const node = nodeRef.current
    const anchor = anchorRef.current
    if (node && anchor?.parentNode) {
      anchor.after(node)
      anchor.remove()
    }
    anchorRef.current = null
    setIsActive(false)
  }, [nodeRef])

  const exit = useCallback(() => {
    const pipWindow = window.documentPictureInPicture?.window
    if (!pipWindow) return
    restoreNode()
    pipWindow.close()
  }, [restoreNode])

  const toggle = useCallback(async () => {
    const docPip = window.documentPictureInPicture
    const node = nodeRef.current
    if (!docPip || !node) return

    if (docPip.window) {
      exit()
      return
    }

    const anchor = document.createComment("video-pip-anchor")
    node.after(anchor)
    anchorRef.current = anchor

    let pipWindow: Window
    try {
      // Must run straight from the click: the browser rejects the request
      // once the user activation has been spent.
      pipWindow = await docPip.requestWindow({ width: 480, height: 270 })
    } catch {
      anchor.remove()
      anchorRef.current = null
      return
    }
    copyStyles(pipWindow)
    pipWindow.document.body.style.margin = "0"
    pipWindow.document.body.style.background = "#000"
    pipWindow.document.body.style.overflow = "hidden"
    pipWindow.document.body.appendChild(node)
    setIsActive(true)

    pipWindow.addEventListener("pagehide", restoreNode, { once: true })
  }, [nodeRef, exit, restoreNode])

  // Restore the node if the component unmounts while still popped out
  useEffect(() => () => exit(), [exit])

  return { isSupported, isActive, toggle, exit }
}
