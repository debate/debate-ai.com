import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DUd-kn8W.js";var t=e(),n={title:`Create New Round \u2014 Registered-User Invites & Notifications`},r=`# Create New Round \u2014 Registered-User Invites & Account Notifications [#create-new-round--registered-user-invites--account-notifications]

Links the Create New Round dialog's debater/judge/spectator fields to real
accounts: typing autocompletes against registered users, and submitting
the form invites everyone on the round \u2014 a registered user in-app, anyone
else by email.

- **Dialog:** \`RoundEditorDialog\` (\`/debate\`'s "Create New Round" action)
- **Notifications route:** \`/notifications\`
- **Package:** \`debate-round\`

## What it does [#what-it-does]

Each debater/judge/spectator field is a \`UserAutocomplete\`. On submit,
every non-empty, non-self email goes to \`POST /api/rounds/invite\`: a
registered user gets an in-app notification, everyone else gets a Resend
email invite. A polling hook toasts new notifications while a tab is open.

## Data flow [#data-flow]

\`\`\`
dialogs/CreateRoundDialog/UserAutocomplete.tsx \u2192 GET /api/users/search
dialogs/CreateRoundDialog/useRoundEditorForm.ts#handleSubmit
  \u2192 dispatchRoundInvites(...) \u2192 POST /api/rounds/invite
hooks/useAccountNotifications.ts (polls every 30s)
  \u2192 GET /api/notifications
panels/AccountNotificationsPanel.tsx \u2192 PATCH /api/notifications
\`\`\`

## Known gaps [#known-gaps]

Inviting doesn't sync the round itself server-side. No follow-ups remain
open on the "only round creation sends invites, not later edits" gap:
editing an existing round now also invites whichever debater/judge/spectator
emails are newly added, comparing the round's previous participant list
against the submitted one (\`useRoundEditorForm.ts#handleSubmit\`'s edit-mode
branch, via \`round-invite-client.ts#computeAddedInviteEmails\`). Participants
already on the round when the edit was made aren't re-invited.
`,i={contents:[{heading:`create-new-round--registered-user-invites--account-notifications`,content:`Links the Create New Round dialog's debater/judge/spectator fields to real
accounts: typing autocompletes against registered users, and submitting
the form invites everyone on the round \u2014 a registered user in-app, anyone
else by email.`},{heading:`create-new-round--registered-user-invites--account-notifications`,content:'**Dialog:** `RoundEditorDialog` (`/debate`\'s "Create New Round" action)'},{heading:`create-new-round--registered-user-invites--account-notifications`,content:"**Notifications route:** `/notifications`"},{heading:`create-new-round--registered-user-invites--account-notifications`,content:"**Package:** `debate-round`"},{heading:`what-it-does`,content:"Each debater/judge/spectator field is a `UserAutocomplete`. On submit,\nevery non-empty, non-self email goes to `POST /api/rounds/invite`: a\nregistered user gets an in-app notification, everyone else gets a Resend\nemail invite. A polling hook toasts new notifications while a tab is open."},{heading:`known-gaps`,content:`Inviting doesn't sync the round itself server-side. No follow-ups remain
open on the "only round creation sends invites, not later edits" gap:
editing an existing round now also invites whichever debater/judge/spectator
emails are newly added, comparing the round's previous participant list
against the submitted one (\`useRoundEditorForm.ts#handleSubmit\`'s edit-mode
branch, via \`round-invite-client.ts#computeAddedInviteEmails\`). Participants
already on the round when the edit was made aren't re-invited.`}],headings:[{id:`create-new-round--registered-user-invites--account-notifications`,content:`Create New Round \u2014 Registered-User Invites & Account Notifications`},{id:`what-it-does`,content:`What it does`},{id:`data-flow`,content:`Data flow`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#create-new-round--registered-user-invites--account-notifications`,title:(0,t.jsx)(t.Fragment,{children:`Create New Round \u2014 Registered-User Invites & Account Notifications`})},{depth:2,url:`#what-it-does`,title:(0,t.jsx)(t.Fragment,{children:`What it does`})},{depth:2,url:`#data-flow`,title:(0,t.jsx)(t.Fragment,{children:`Data flow`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`create-new-round--registered-user-invites--account-notifications`,children:`Create New Round \u2014 Registered-User Invites & Account Notifications`}),`
`,(0,t.jsx)(n.p,{children:`Links the Create New Round dialog's debater/judge/spectator fields to real
accounts: typing autocompletes against registered users, and submitting
the form invites everyone on the round \u2014 a registered user in-app, anyone
else by email.`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Dialog:`}),` `,(0,t.jsx)(n.code,{children:`RoundEditorDialog`}),` (`,(0,t.jsx)(n.code,{children:`/debate`}),`'s "Create New Round" action)`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Notifications route:`}),` `,(0,t.jsx)(n.code,{children:`/notifications`})]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-round`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-does`,children:`What it does`}),`
`,(0,t.jsxs)(n.p,{children:[`Each debater/judge/spectator field is a `,(0,t.jsx)(n.code,{children:`UserAutocomplete`}),`. On submit,
every non-empty, non-self email goes to `,(0,t.jsx)(n.code,{children:`POST /api/rounds/invite`}),`: a
registered user gets an in-app notification, everyone else gets a Resend
email invite. A polling hook toasts new notifications while a tab is open.`]}),`
`,(0,t.jsx)(n.h2,{id:`data-flow`,children:`Data flow`}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`dialogs/CreateRoundDialog/UserAutocomplete.tsx \u2192 GET /api/users/search`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`dialogs/CreateRoundDialog/useRoundEditorForm.ts#handleSubmit`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 dispatchRoundInvites(...) \u2192 POST /api/rounds/invite`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`hooks/useAccountNotifications.ts (polls every 30s)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 GET /api/notifications`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`panels/AccountNotificationsPanel.tsx \u2192 PATCH /api/notifications`})})]})})}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsxs)(n.p,{children:[`Inviting doesn't sync the round itself server-side. No follow-ups remain
open on the "only round creation sends invites, not later edits" gap:
editing an existing round now also invites whichever debater/judge/spectator
emails are newly added, comparing the round's previous participant list
against the submitted one (`,(0,t.jsx)(n.code,{children:`useRoundEditorForm.ts#handleSubmit`}),`'s edit-mode
branch, via `,(0,t.jsx)(n.code,{children:`round-invite-client.ts#computeAddedInviteEmails`}),`). Participants
already on the round when the edit was made aren't re-invited.`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};