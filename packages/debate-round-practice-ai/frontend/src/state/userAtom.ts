import { atom } from "jotai";
import type { User } from "@/types/user";

export const userAtom = atom<User | null>(null);
