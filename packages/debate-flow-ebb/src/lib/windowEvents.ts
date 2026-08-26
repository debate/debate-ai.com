/**
 * Listening for a shell event that is aimed at one window.
 *
 * Tauri's targeting only holds if both halves name the label. `Emitter::emit`
 * reaches every webview whatever handle the shell called it on - a
 * `WebviewWindow` included - and a listener registered for the default `Any`
 * target matches a narrowed emit regardless, so naming the window on one side
 * alone narrows nothing. Every window here is a fully independent flow editor,
 * so an event with one intended recipient - a menu accelerator, a CardMirror
 * card, a shared-editing session's traffic - has to say which window it is for
 * on both sides. The Rust half is `windows::emit_target`.
 *
 * An event every window must see stays a plain broadcast on the Rust side, and a
 * broadcast still reaches these listeners.
 */
export async function listenHere<T>(
    event: string,
    handler: (payload: T) => void,
): Promise<() => void> {
    // Dynamic because Tauri's api package only exists inside the desktop shell;
    // a static import would pull it into the web bundle and break the export.
    const [{ listen }, { getCurrentWebviewWindow }] = await Promise.all([
        import("@tauri-apps/api/event"),
        import("@tauri-apps/api/webviewWindow"),
    ]);
    const un = await listen<T>(event, (e) => handler(e.payload), {
        target: getCurrentWebviewWindow().label,
    });
    return () => un();
}
