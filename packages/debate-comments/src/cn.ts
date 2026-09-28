import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind-aware class joiner, matching the one the rest of the frontend uses. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
