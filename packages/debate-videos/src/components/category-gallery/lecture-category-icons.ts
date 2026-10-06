/**
 * @fileoverview Maps lecture category labels to Lucide icons for the sidebar
 * tree and the grid gallery. Both surfaces need the same icon per category, so
 * they share this map rather than restating it.
 *
 * In the sidebar they draw in the tree's gray like every other row's icon.
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
  ClipboardList,
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
  "Round Analysis": ClipboardList,
};
