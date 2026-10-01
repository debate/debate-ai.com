/**
 * @fileoverview Maps lecture category labels to Lucide icons for the sidebar
 * tree and the grid gallery. Both surfaces need the same icon per category, so
 * they share this map rather than restating it.
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
  AlertTriangle,
  Mic,
  BookOpen,
  Target,
  MessageSquare,
  Trophy,
  Zap,
  Globe,
  Film,
  Users,
  GraduationCap,
  LayoutGrid,
} from "lucide-react";

export const LECTURE_CATEGORY_ICONS: Record<string, LucideIcon> = {
  "Affirmative Strategy": Lightbulb,
  "Negative Strategy": Shield,
  "Critique / Critical Theory": Brain,
  "Counterplans & Theory": Scale,
  "Topicality & Framework": Gavel,
  Disadvantages: AlertTriangle,
  "Speaking & Delivery": Mic,
  "Research & Flowing": BookOpen,
  "PF & LD Topic Analysis": Target,
  "Policy Topic Lectures": MessageSquare,
  "Demo Debates": Trophy,
  "Judge & Tournament Skills": Trophy,
  "Impact Calculus & Evidence": Zap,
  "Philosophy & IR Theory": Globe,
  "Public Forum": MessageSquare,
  "All Lectures": LayoutGrid,
  "Documentaries & Culture": Film,
  "Camp & Coaching Advice": Users,
  "Novice & Introductory": GraduationCap,
};
