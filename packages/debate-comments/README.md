# debate-comments

Threaded comments — the YouTube/Instagram-style discussion UI: a comment, replies, replies
to replies in a tree, likes, and a composer. One component, mounted against anything that
can be discussed.

```tsx
import { CommentSection } from "debate-comments"

<CommentSection resourceType="video" resourceId={videoId} />
```

That is the whole integration. A surface adopts comments by naming what it is; a second
one is a second mount of the same component, not a second schema, a second set of routes, or
a second set of components.

## What it does

- **Replies, and replies to replies.** `parentId` makes the tree; the server ships it
  already nested, so the render path is a straight walk of the response.
- **A reply box per comment, on demand.** A root's replies start open; a reply's own
  replies start closed, so a busy thread does not arrive as a wall.
- **Likes.** One button, one handler. The heart fills optimistically and the count settles
  on what the server reports; a failed request puts the row back the way it was.
- **Delete your own.** Soft delete — the body goes, the replies stay, because removing one
  post should not take a sub-conversation with it.
- **Readable signed out.** A signed-out reader gets every comment and a sign-in prompt
  where the composer would be.

## Forums

`@debate-ai/comments/forums` (types, validation, client) and
`@debate-ai/comments/forums/ui` (`ForumsHub`, `ForumThreadView`, …) build a
forum on top of the comment tree: a thread is a `forum_threads` row — title,
opening post, a **category** from `FORUM_CATEGORIES`, and a **like count** —
and its replies are comments with `resourceType: "thread"`.

- The feed (`GET /api/forums?category=&sort=&cursor=`) lists one board or all
  of them, in `active` (last posted to), `new` or `top` (most liked) order,
  paged by a `(key, id)` cursor.
- `POST /api/forums/:id/like` toggles a like on the opening post
  (`ForumLikeButton`); replies use the comment like route.
- `ForumThreadView` mounts `CommentSection` with `expandAllReplies`, so the
  whole tree opens on arrival.

## Folding a branch

Every `CommentRow` can be folded to one line — author, time, likes, and how
many replies it hides — from the `[–]` button beside its time or by clicking
the connector line beside its replies, Reddit-style. `[+]` unfolds it. This is
separate from the "N replies" toggle, which hides only the replies.

## The depth ceiling

`MAX_REPLY_DEPTH` is the number of levels a comment may sit at, counting a top-level
comment as level 1. The UI stops *offering* a reply button there, and the server refuses
one — from the same constant, because the failure a disagreement produces is a reply that
appears to work and then vanishes.

Indent follows the tree but only twice: a first-level reply is inset from its parent, and
everything deeper is inset slightly from that. Six replies deep would otherwise indent a
comment clean off the side of a phone. The connector line stays on every level, so the
structure is still legible once the indent stops growing.

## Where the data lives

One polymorphic table for every kind of thing that can be discussed —
`comments` plus `comment_likes` in the web app's Drizzle schema, addressed by
`resourceType` + `resourceId`. The routes are:

| Route | |
|---|---|
| `GET /api/comments?resourceType=&resourceId=` | the whole thread, nested, plus the viewer. Public. |
| `POST /api/comments` | a comment or a reply. Account-only. |
| `POST /api/comments/:id/like` | flips the viewer's like, answers with the count the rows hold. |
| `DELETE /api/comments/:id` | soft-deletes the viewer's own comment. |
| `GET /api/forums` · `POST /api/forums` | the forum feed (by category and order) · open a thread. |
| `GET /api/forums/:id` · `POST /api/forums/:id/like` | one thread · toggle a like on it. |

The read is one query — a left join across `user` and `comment_likes`, folded together with
a `count()` and a conditional `max()` — so the like count and the viewer's own like come
back in the same scan. `GET` carries `viewer` with it because a client-only mount has no
server boundary to ask.

## Package layout

```
debate-comments/
├── src/
│   ├── client.ts        # the four API calls, fetch-injectable
│   ├── format.ts        # relative timestamps, initials, reply-toggle labels
│   ├── tree.ts          # build / update / insert on a nested comment tree
│   ├── types.ts         # the wire format, shared with the API
│   ├── CommentSection   # the section: fetch on mount, post, like, delete
│   ├── CommentRow       # one comment and its replies — the recursive half
│   ├── CommentComposer  # the box a comment is typed into
│   ├── CommentAvatar    # picture, or initials on a neutral tile
│   └── index.ts         # public entry point
└── test/                # Vitest suites: tree maths, formatting, client, and the
                         # section mounted in jsdom
```

## Tests

```bash
bun run test        # or: npx vitest run
bun run coverage    # writes ./coverage for this package alone
```

Suites live in `test/` and mirror the `src/` layout. `test/comment-section.test.tsx` mounts
the section into jsdom — `renderToStaticMarkup` renders the server pass once and stops, so
it cannot see a fetch resolve, a reply land under its parent, or a like roll back, and
those are the parts most worth testing. Coverage for every package is merged at the repo
root by `bun run coverage` and uploaded to [Codecov](https://app.codecov.io/gh/debate/debate-ai.com) by CI.
