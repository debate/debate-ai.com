import { getAuth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

const authPromise = getAuth();

export const { GET, POST } = toNextJsHandler(await authPromise);
