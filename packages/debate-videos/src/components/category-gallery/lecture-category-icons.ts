/**
 * @fileoverview Maps lecture category labels to Lucide icons for the sidebar
 * tree and the grid gallery. Both surfaces need the same icon per category, so
 * they share this map rather than restating it.
 *
 * In the sidebar these are the only colored icons: every other row draws in
 * the tree's gray, and each lecture category gets its own color
 * ({@link LECTURE_CATEGORY_ICON_COLORS}) so the shelves read apart at a glance.
 *
 * @module components/category-gallery/lecture-category-icons
 */

import type { LucideIcon } from "lucide-react";
import {
  Lightbulb,
  Shield,
  Brain,
  Scale,
  Gavel,
  Swords,
  Ruler,
  Award,
  AlertTriangle,
  Mic,
  BookOpen,
  Target,
  MessageSquare,
  Zap,
  Globe,
  Film,
  Users,
  GraduationCap,
  LayoutGrid,
  Presentation,
} from "lucide-react";

export const LECTURE_CATEGORY_ICONS: Record<string, LucideIcon> = {
  "Affirmative Strategy": Lightbulb,
  "Negative Strategy": Shield,
  "Critique / Critical Theory": Brain,
  "Counterplans & Theory": Scale,
  "Topicality & Framework": Ruler,
  Disadvantages: AlertTriangle,
  "Speaking & Delivery": Mic,
  "Research & Flowing": BookOpen,
  "Topic Lectures": Presentation,
  "PF & LD Topic Analysis": Target,
  "Policy Topic Lectures": MessageSquare,
  "Demo Debates": Swords,
  "Judge & Tournament Skills": Gavel,
  "Impact Calculus & Evidence": Zap,
  "Philosophy & IR Theory": Globe,
  "Public Forum": Users,
  "All Lectures": LayoutGrid,
  "Documentaries & Culture": Film,
  "Camp & Coaching Advice": Award,
  "Novice & Introductory": GraduationCap,
};

/**
 * The text color each lecture category's icon draws in, in the sidebar tree.
 * Taken from the first stop of the category's gradient in the gallery
 * carousel, so a shelf is the same color in both places. Full class strings,
 * so Tailwind's scanner finds them.
 */
export const LECTURE_CATEGORY_ICON_COLORS: Record<string, string> = {
  "Affirmative Strategy": "text-blue-500",
  "Negative Strategy": "text-red-500",
  "Critique / Critical Theory": "text-purple-500",
  "Counterplans & Theory": "text-orange-500",
  "Topicality & Framework": "text-indigo-500",
  Disadvantages: "text-cyan-500",
  "Speaking & Delivery": "text-green-500",
  "Research & Flowing": "text-amber-500",
  "Topic Lectures": "text-lime-600",
  "PF & LD Topic Analysis": "text-teal-500",
  "Policy Topic Lectures": "text-violet-500",
  "Demo Debates": "text-sky-500",
  "Judge & Tournament Skills": "text-rose-500",
  "Impact Calculus & Evidence": "text-yellow-500",
  "Philosophy & IR Theory": "text-violet-500",
  "Public Forum": "text-teal-500",
  "All Lectures": "text-primary",
  "Documentaries & Culture": "text-pink-500",
  "Camp & Coaching Advice": "text-emerald-500",
  "Novice & Introductory": "text-fuchsia-500",
};
