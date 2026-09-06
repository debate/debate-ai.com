/**
 * @fileoverview Guest stand-in for qwksearch's better-auth client.
 *
 * The embedded qwksearch UI talks to qwksearch.com's public, unauthenticated
 * API surface; there is no shared session with debate-ai.com and qwksearch's
 * own auth routes reject cross-origin sign-in (CORS), so the embed runs
 * permanently as a guest. Chat history for guests is kept client-side in
 * localStorage by research-agent-ui itself.
 *
 * The object satisfies both consumers of an auth client in the ported code:
 * `SessionProvider` (ResearchAgentAuthClient) and the ported settings
 * Account section (`useSession`, `signIn.social`, `signOut`).
 */
import { toast } from "sonner"
import type { ResearchAgentAuthClient } from "research-agent-ui"
import { QWKSEARCH_ORIGIN } from "./base-url"

const explainGuestOnly = () => {
  toast.info(`Sign-in for research chats is available on ${QWKSEARCH_ORIGIN}`)
}

/**
 * Structurally satisfies `ResearchAgentAuthClient` (its members accept a
 * superset of the calls the ported code makes — some call sites pass no
 * arguments, so every parameter here is optional).
 */
export const authClient = {
  getSession: async () => ({ data: null }),
  useSession: () => ({ data: null, isPending: false as const }),
  oneTap: (_opts?: { fetchOptions: { onSuccess: () => void } }) => {},
  signIn: {
    social: (_opts?: { provider: string; callbackURL: string }) => {
      explainGuestOnly()
    },
  },
  signOut: async (opts?: { fetchOptions?: { onSuccess?: () => void } }) => {
    opts?.fetchOptions?.onSuccess?.()
    return { data: null }
  },
} satisfies ResearchAgentAuthClient & Record<string, unknown>
