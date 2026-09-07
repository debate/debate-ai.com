"use client"

/**
 * The /contacts page body: the account-linked contacts list and the cards
 * contacts have shared, as two tabs over one pair of polling hooks (each
 * panel accepts a shared hook instance so the page polls once, not twice).
 *
 * Opening a shared card and sharing a card both happen in the editor, so
 * both actions route to /reason-editor with a query the editor's
 * `ShareWithContacts` control reads: `?share=<id>` joins that share in
 * place, `?shareWith=<userId>` opens the share dialog with that contact
 * preselected. `?tab=shared` (what a "card shared" notification links to)
 * lands on the Shared tab.
 */

import { Suspense, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ContactsPanel,
  SharedCardsPanel,
  useCardShares,
  useContacts,
  type CardShareEntry,
  type ContactEntry,
} from "debate-team-collaboration"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../lib/ui/primitives/tabs"
import { useSession } from "@/lib/hooks/useSession"

function ContactsHubInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated } = useSession()
  const contacts = useContacts(isAuthenticated)

  const openShare = useCallback(
    (share: CardShareEntry) => router.push(`/reason-editor?share=${share.id}`),
    [router],
  )
  const shares = useCardShares(isAuthenticated, { onOpen: openShare })

  const shareWith = useCallback(
    (contact: ContactEntry) => router.push(`/reason-editor?shareWith=${encodeURIComponent(contact.user.id)}`),
    [router],
  )

  const initialTab = searchParams.get("tab") === "shared" ? "shared" : "contacts"

  return (
    <Tabs defaultValue={initialTab} className="max-w-2xl mx-auto">
      <TabsList className="mx-4 sm:mx-6 mb-2">
        <TabsTrigger value="contacts">
          Contacts
          {contacts.incoming.length > 0 && (
            <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
              {contacts.incoming.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="shared">
          Shared cards
          {shares.unopenedCount > 0 && (
            <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
              {shares.unopenedCount}
            </span>
          )}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="contacts">
        <ContactsPanel enabled={isAuthenticated} contacts={contacts} onShareWith={shareWith} />
      </TabsContent>
      <TabsContent value="shared">
        <SharedCardsPanel
          enabled={isAuthenticated}
          shares={shares}
          contacts={contacts.contacts}
          onOpen={openShare}
        />
      </TabsContent>
    </Tabs>
  )
}

export function ContactsHub() {
  return (
    <Suspense>
      <ContactsHubInner />
    </Suspense>
  )
}
