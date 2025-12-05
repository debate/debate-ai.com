# FLOW Research Manager - Flow & Timer System

## Overview

This is a Next.js/React implementation of the FLOW debate flow and timer system, converted from the original Svelte codebase.

## What Has Been Implemented

### Database Schema
- ✅ `flows` table - Stores debate flow data with nested box structure
- ✅ `timer_presets` table - Stores custom speech timer configurations
- ✅ Full relations with users and authentication

### Core Types & Models (`lib/flow/`)
- ✅ `types.ts` - Complete TypeScript definitions for:
  - Flow and Box structures (nested argument trees)
  - Timer states and speech definitions
  - Debate style configurations (Policy, LD, PF, Custom)
  - Standard timer presets for each debate format
- ✅ `helpers.ts` - Utility functions:
  - `newFlow()` - Create new flows with debate style templates
  - `newBox()` - Create new argument boxes
  - `boxFromPath()` - Navigate nested box tree
  - `deepClone()` - Deep cloning utility

### Components

#### Timer Component (`components/timer/speech-timer.tsx`)
- ✅ Full-featured debate speech timer
- ✅ Multiple speech support with preset times
- ✅ Visual progress bar
- ✅ Color-coded states (running, warning, time up, secondary speeches)
- ✅ Play/Pause/Reset controls
- ✅ Quick navigation between speeches
- ✅ Audio alert on completion

## Original Svelte Flow System

The original FLOW system in `src/lib/components/Flow/` contains 40+ files with extensive features:

### Features in Original (Not Yet Ported)
- Complex nested box editing with rich text
- Drag-and-drop box reordering
- Keyboard shortcuts for navigation
- Multiple debate format templates
- History/undo system
- File import/export
- Flow sharing and collaboration
- Auto-save functionality
- Customizable themes and settings
- Debate dictionary integration
- Sortable flow tabs
- Box crossing-out and highlighting
- Multiple column layouts
- Responsive column headers

### Files in Original System
- `Main.svelte` - Main app container with settings
- `MainFlow.svelte` - Flow management and tabs
- `Flow.svelte` - Individual flow display
- `Box.svelte` - Editable argument box (17k+ lines!)
- `BoxControl.svelte` - Box editing controls
- `SpeechTimer.svelte` - Timer component
- `Timers.svelte` - Multiple timer management
- `Settings.svelte` - User preferences
- Plus 30+ more component and utility files

## Next Steps for Full Implementation

To complete the Flow system, you would need to port:

1. **Flow Display Component** - Show columns and nested boxes
2. **Box Editor** - Editable text boxes with keyboard shortcuts
3. **Flow Manager** - Tab system for multiple flows
4. **Settings System** - Theme, font, column customization
5. **File Operations** - Save/load flows to/from database
6. **History System** - Undo/redo functionality
7. **Debate Templates** - Pre-configured debate formats
8. **Export Features** - PDF, text, and other formats

## Using What's Available

### Creating a Flow
```typescript
import { newFlow } from "@/lib/flow/helpers";
import { debateStyles } from "@/lib/flow/types";

const flow = newFlow(
  crypto.randomUUID(),
  "My Debate Round",
  0,
  "Policy Debate",
  "primary"
);
```

### Using the Timer
```tsx
import { SpeechTimer } from "@/components/timer/speech-timer";
import { standardTimerPresets } from "@/lib/flow/types";

function MyPage() {
  return (
    <SpeechTimer
      speeches={standardTimerPresets["Policy Debate"]}
      onComplete={() => console.log("Time's up!")}
    />
  );
}
```

### Database Operations
```typescript
import { db } from "@/lib/db";
import { flows } from "@/lib/db/schema";

// Save a flow
await db.insert(flows).values({
  userId: session.user.id,
  name: "Championship Round",
  debateStyle: "Policy Debate",
  data: {
    columns: flow.columns,
    invert: flow.invert,
    children: flow.children,
  },
});

// Load user's flows
const userFlows = await db.query.flows.findMany({
  where: eq(flows.userId, session.user.id),
});
```

## Architecture Decisions

### Why Simplified?

The original Svelte implementation is extremely comprehensive (17k lines in Box.svelte alone). For a Next.js MVP, we've created:
- Core data structures that match the original
- Essential timer functionality
- Database persistence layer
- Foundation for incremental feature addition

### Incremental Development Path

You can build on this foundation by adding features in this order:

1. **Basic Flow Display** - Read-only view of boxes and columns
2. **Simple Box Editing** - Click to edit box content
3. **Add/Delete Boxes** - Basic box management
4. **Column Management** - Add/remove/rename columns
5. **Keyboard Shortcuts** - Arrow keys for navigation
6. **Auto-save** - Persist changes to database
7. **Multiple Flows** - Tab management
8. **Advanced Features** - Drag-drop, themes, etc.

## File Structure

```
flow-nextjs/
├── lib/
│   ├── flow/
│   │   ├── types.ts          # Core type definitions
│   │   └── helpers.ts        # Utility functions
│   └── db/
│       └── schema.ts         # Database schema (includes flows)
├── components/
│   ├── timer/
│   │   └── speech-timer.tsx  # Speech timer component
│   └── flow/
│       └── (future components)
└── app/
    └── flow/
        └── (future page routes)
```

## Integration with Existing Features

The Flow system integrates with:
- **Authentication** - better-auth for user accounts
- **Database** - Drizzle ORM with flows and timer_presets tables
- **UI** - shadcn/ui components for consistent styling

## Contributing

To add Flow features:
1. Refer to original Svelte files in `src/lib/components/Flow/`
2. Convert Svelte reactivity to React hooks
3. Replace Svelte stores with React Context/state
4. Adapt CSS to Tailwind classes
5. Use shadcn/ui components where possible
