# CLAUDE.md — `debate-flow-ebb` (`packages/debate-flow`)

**Package name:** `debate-flow-ebb` — filter on that, not the directory.
Private. Entry: `src/EbbFlowEmbed.tsx`. Tests in `test/`.

`ebb`, the local-first, keyboard-first flow editor, ported in as a workspace
package. `EbbFlowEmbed` mounts the flow grid as **one column of a host page** —
principally `debate-round`'s live round editor.

## Public surface

`.` (the embed) · `./settings-panel` · `./store` · `./tools` · `./tooltip` ·
`./styles/ebb-scope.css`

## The two constraints that define this package

1. **Local-first.** State lives with the editor and survives without a network.
   Do not add a code path that blocks rendering or input on a server round-trip;
   a debater flows a round in a gym with no wifi.
2. **Keyboard-first, embedded in someone else's page.** Two things follow:
   - **Scoped styles.** `styles/ebb-scope.css` exists so ebb's CSS cannot leak
     into the host page, or the host's into ebb. Keep new styles inside the
     scope; never add a bare element selector.
   - **Key handling must not fight the host.** The embed captures keys for
     flowing; the host app has its own shortcuts (including an app-wide command
     palette on Ctrl/Cmd-Shift-Space). Swallowing a host shortcut, or letting
     the host swallow a flow key, is the classic bug here.

State, bridge, palette and scoped styles all stay in this package — the host
mounts it and gets out of the way.
