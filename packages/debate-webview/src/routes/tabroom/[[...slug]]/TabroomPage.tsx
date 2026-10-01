/**
 * Tabroom's own beta site, framed. `/practice/tournaments` renders the
 * same tournaments natively, from the `debate-tournaments` UI over this app's
 * Tabroom proxy.
 */
export function TabroomPage() {
  return (
    <iframe
      src="https://beta.tabroom.com"
      title="Tabroom"
      loading="lazy"
      className="h-[calc(100dvh-70px)] w-full border-0 md:h-screen"
    />
  )
}