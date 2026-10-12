/**
 * @fileoverview The external/legal links the sidebar footer renders, shown as
 * one list wherever they appear.
 *
 * Data rather than JSX so both surfaces can read the same list: the footer
 * below the sidebar tree (`./footer`) prints all of them in one row set,
 * while `CategoryDock`'s Settings menu — the only place these are reachable
 * on a phone, where the sidebar is hidden — lists them all in its one
 * "Site Links" submenu. Site and debate-community links share that one
 * category rather than splitting into two. Adding a link here puts it in both
 * places at once.
 *
 * @module ui/layout/footer-links
 */

import {
  Book,
  BookOpen,
  BookMarked,
  CircleHelp,
  Calendar,
  FileText,
  LayoutGrid,
  LockKeyhole,
  Scale,
  type LucideIcon,
} from "lucide-react";
import { SiDiscord, SiGithub, SiReddit, type IconType } from "@icons-pack/react-simple-icons";
import { FaDiscord } from "react-icons/fa";
import type { IconType as ReactIconType } from "react-icons";

export interface FooterLink {
  url: string;
  text: string;
  icon: LucideIcon | IconType | ReactIconType;
  /**
   * Forces a full page load for an in-app-looking URL.
   *
   * Only `/docs` needs it: the help site renders without the app shell and
   * with its own stylesheet, so it is entered with a full page load rather
   * than a client-side route change. Everything else on the site is an
   * ordinary route and is followed in place — the app keeps its sidebar and
   * its player instead of reloading the whole document.
   */
  hardNavigate?: boolean;
}

export const FOOTER_LINKS: FooterLink[] = [
  // `/docs` is the help site (`packages/debate-help-docs`, mounted at the
  // app's `app/docs`), reached by a plain navigation like the external
  // entries here.
  { url: "/docs", text: "Docs", icon: CircleHelp, hardNavigate: true },
  // `/practice/features` is the whole catalog. It is listed here because the app
  // dock's Settings menu no longer carries an "Apps" submenu spelling that
  // catalog out, so this row is how the menu reaches it. An ordinary in-app
  // route: following it keeps the sidebar (`/practice/features` is one of the
  // sidebar's own destinations — see `sidebar-routes.ts`) rather than
  // reloading into a bare page.
  // { url: "/practice/features", text: "Features", icon: LayoutGrid },
  { url: "https://github.com/debate", text: "Github", icon: SiGithub },
  { url: "https://discord.gg/wMxeKZ3c9e", text: "Support", icon: FaDiscord },
  { url: "/legal/privacy", text: "Privacy", icon: LockKeyhole },
  { url: "https://www.reddit.com/r/Debate+PublicForumDebate+lincolndouglas+policydebate/", text: "Reddit", icon: SiReddit },
  // { url: "https://www.tabroom.com/index/index.mhtml", text: "Tournaments", icon: Calendar },
  // { url: "https://opencaselist.com", text: "Research", icon: BookMarked },
];
