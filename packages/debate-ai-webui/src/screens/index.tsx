/**
 * @fileoverview The screens the shell ships with, and the nav order they
 * appear in.
 *
 * Kept as plain data — id, label, description, render — rather than a `switch`
 * in the shell, so a host can append its own screen (the extension appends its
 * settings) and so the nav is assertable without rendering anything.
 *
 * @module screens
 */

import type { WebUIScreen } from "../types";
import { CardSearchScreen } from "./CardSearchScreen";
import { RankingsScreen } from "./RankingsScreen";
import { ReuseCheckScreen } from "./ReuseCheckScreen";
import { ToolCatalogScreen } from "./ToolCatalogScreen";
import { VideoLibraryScreen } from "./VideoLibraryScreen";

export { CardSearchScreen } from "./CardSearchScreen";
export { RankingsScreen } from "./RankingsScreen";
export { ReuseCheckScreen } from "./ReuseCheckScreen";
export { ToolCatalogScreen } from "./ToolCatalogScreen";
export { VideoLibraryScreen } from "./VideoLibraryScreen";

/**
 * The built-in screens, in the app dock's own order: the two library
 * workspaces first, then the evidence check, the standings, and the catalog
 * that reaches everything else.
 */
export const BUILT_IN_SCREENS: WebUIScreen[] = [
  {
    id: "videos",
    label: "Videos",
    description: "Recorded rounds and lectures from the shared archive.",
    render: (context) => <VideoLibraryScreen {...context} />,
  },
  {
    id: "cards",
    label: "Cards",
    description: "Full-text search across the shared evidence index.",
    render: (context) => <CardSearchScreen {...context} />,
  },
  {
    id: "reuse",
    label: "Reuse check",
    description: "Whether a source has already been cut into a card.",
    render: (context) => <ReuseCheckScreen {...context} />,
  },
  {
    id: "rankings",
    label: "Rankings",
    description: "Season bids and Elo standings by division.",
    render: (context) => <RankingsScreen {...context} />,
  },
  {
    id: "tools",
    label: "All tools",
    description: "Every surface in the app, by what it is for.",
    render: (context) => <ToolCatalogScreen {...context} />,
  },
];
