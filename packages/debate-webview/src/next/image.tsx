/**
 * @fileoverview `next/image` for hosts that aren't Next: a plain `<img>`.
 * There is no image optimizer to route through, so the source is used as is.
 */

import { forwardRef, type CSSProperties, type ImgHTMLAttributes } from "react"

export interface StaticImageData {
  src: string
  height: number
  width: number
  blurDataURL?: string
}

export type ImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "width" | "height"> & {
  src: string | StaticImageData
  width?: number | `${number}`
  height?: number | `${number}`
  fill?: boolean
  priority?: boolean
  quality?: number | `${number}`
  placeholder?: string
  blurDataURL?: string
  unoptimized?: boolean
  loader?: unknown
  overrideSrc?: string
}

const FILL: CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%" }

const Image = forwardRef<HTMLImageElement, ImageProps>(function Image(
  { src, width, height, fill, priority, quality: _q, placeholder: _p, blurDataURL: _b, unoptimized: _u, loader: _l, overrideSrc, style, loading, ...rest },
  ref,
) {
  const resolved = typeof src === "string" ? src : src.src
  const w = width ?? (typeof src === "object" && !fill ? src.width : undefined)
  const h = height ?? (typeof src === "object" && !fill ? src.height : undefined)
  return (
    <img
      ref={ref}
      src={overrideSrc ?? resolved}
      width={fill ? undefined : w}
      height={fill ? undefined : h}
      loading={loading ?? (priority ? "eager" : "lazy")}
      decoding="async"
      style={fill ? { ...FILL, ...style } : style}
      {...rest}
    />
  )
})

export default Image
