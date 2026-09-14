/**
 * @fileoverview The external/legal links the sidebar footer renders, split
 * into the two groups the app dock's Settings menu shows them in.
 *
 * Data rather than JSX so both surfaces can read the same list: the footer
 * below the sidebar tree (`./footer`) prints all of them in one row set,
 * while `CategoryDock`'s Settings menu — the only place these are reachable
 * on a phone, where the sidebar is hidden — splits them into its "Site Links"
 * and "Debate Links" submenus by {@link FooterLink.group}. Adding a link here
 * puts it in both places at once.
 *
 * @module ui/layout/footer-links
 */

import {
  Activity,
  Book,
  BookMarked,
  BookOpen,
  Calendar,
  Code2,
  FileText,
  LayoutGrid,
  MessageCircle,
  MessageSquare,
  Scale,
  Shield,
  Trophy,
  type LucideIcon,
} from "lucide-react";

export interface FooterLink {
  url: string;
  text: string;
  icon: LucideIcon;
  /** Which Settings-menu submenu this link belongs to: the site's own
   *  meta/legal links, or the outside debate community. */
  group: "site" | "debate";
}

export const FOOTER_LINKS: FooterLink[] = [
  // `/docs` is the help site (`packages/debate-help-docs`), statically
  // exported into the app's `public/docs` — not a Next route, so it is
  // reached by a plain navigation like any other entry here.
  { url: "/docs", text: "Docs", icon: BookOpen, group: "site" },
  // `/features` is the whole catalog. It is listed here because the app
  // dock's Settings menu no longer carries an "Apps" submenu spelling that
  // catalog out, so this row is how the menu reaches it.
  { url: "/features", text: "Features", icon: LayoutGrid, group: "site" },
  { url: "https://github.com/debate", text: "Github", icon: Code2, group: "site" },
  { url: "https://www.reddit.com/r/Debate+PublicForumDebate+lincolndouglas+policydebate/", text: "Debate Reddit", icon: MessageSquare, group: "debate" },
  { url: "https://www.tabroom.com/index/index.mhtml", text: "Tournaments", icon: Calendar, group: "debate" },
  { url: "https://www.debate.land", text: "Rankings", icon: Trophy, group: "debate" },
  { url: "https://opencaselist.com", text: "Research", icon: BookMarked, group: "debate" },
  { url: "https://debaterhub.com", text: "DebaterHub", icon: Scale, group: "debate" },
  { url: "https://debate101.org/#hub", text: "Resource Links", icon: Book, group: "debate" },
  { url: "https://discord.gg/5PFjqgtkK", text: "Support", icon: MessageCircle, group: "site" },
  { url: "https://stats.uptimerobot.com/V3HfCBM9de", text: "Status", icon: Activity, group: "site" },
  { url: "/legal/privacy", text: "Privacy", icon: Shield, group: "site" },
  { url: "https://docs.google.com/document/d/1hq7-DE6ls2ryVtOttxR4BNpRdP7xUbBr0M3SMYefek8/edit", text: "Rules", icon: FileText, group: "site" },
];

/** The links `CategoryDock`'s "Site Links" submenu shows. */
export const SITE_FOOTER_LINKS: FooterLink[] = FOOTER_LINKS.filter((link) => link.group === "site");

/** The links `CategoryDock`'s "Debate Links" submenu shows. */
export const DEBATE_FOOTER_LINKS: FooterLink[] = FOOTER_LINKS.filter((link) => link.group === "debate");
