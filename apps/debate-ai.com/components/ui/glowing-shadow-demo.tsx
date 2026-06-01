import { GlowingShadow } from "@/components/ui/glowing-shadow";

export default function GlowingShadowDemo() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <GlowingShadow>
        <span className="pointer-events-none z-10 m-8 text-center text-9xl leading-none font-semibold tracking-tighter text-white">
          Glowing Shadow
        </span>
      </GlowingShadow>
    </div>
  )
}
