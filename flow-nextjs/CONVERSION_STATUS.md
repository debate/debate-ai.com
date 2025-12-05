# FLOW Svelte to React Conversion Status

## Overview
The original FLOW system has 44 files in Svelte. This document tracks the conversion progress to React/Next.js with shadcn/ui.

## Completed ✅

### State Management
- ✅ `contexts/flow-context.tsx` - Replaces Svelte stores for Flow state
  - Flows array management
  - Selected flow tracking
  - Add/delete/update/move operations
  - Auto-save to localStorage

- ✅ `contexts/settings-context.tsx` - Replaces settings.ts
  - All 19 settings (debate style, colors, fonts, etc.)
  - Load/save to localStorage
  - Type-safe setting management

### Database
- ✅ `lib/db/schema.ts` - Added flows and timer_presets tables
- ✅ Full Drizzle ORM integration with auth

### Core Types
- ✅ `lib/flow/types.ts` - Complete type definitions
- ✅ `lib/flow/helpers.ts` - Utility functions

### Components
- ✅ `components/timer/speech-timer.tsx` - Full-featured speech timer

## In Progress 🚧

### Core UI Components
Need to convert from Svelte to React + shadcn/ui:

- ⏳ `Text.svelte` → `components/flow/text-input.tsx`
  - Auto-height textarea
  - Placeholder support
  - Strikethrough mode

- ⏳ `Tab.svelte` → `components/flow/flow-tab.tsx`
  - Flow tab with color palette
  - Selected state
  - Click handling

- ⏳ `NavTab.svelte` → Can use Next.js Link + shadcn Button

- ⏳ `Button.svelte` → Can mostly use shadcn/ui Button
  - Icon support needed
  - Tooltip integration

## Remaining Components 📋

### High Priority (Core Functionality)

#### Box System
- [ ] `Box.svelte` (17k lines!) → `components/flow/box.tsx`
  - Nested box rendering
  - Content editing
  - Focus management
  - Add/delete children
  - Keyboard navigation
  - Crossing out
  - Empty state handling

- [ ] `BoxControl.svelte` → `components/flow/box-controls.tsx`
  - Add/delete buttons
  - Format buttons (bold, cross out)
  - Undo/redo

#### Flow Display
- [ ] `Flow.svelte` → `components/flow/flow-display.tsx`
  - Column headers
  - Column backgrounds
  - Scrollable content
  - Nested box tree rendering

- [ ] `Header.svelte` → `components/flow/column-header.tsx`
  - Column title
  - Add box button

- [ ] `MainFlow.svelte` → `components/flow/main-flow.tsx`
  - Tab bar
  - Flow content area
  - Sidebar
  - Add flow buttons

#### Flow Management
- [ ] `Title.svelte` → `components/flow/flow-title.tsx`
  - Editable flow name
  - Add tab button
  - Flow export button

- [ ] `AddTab.svelte` → `components/flow/add-tab-button.tsx`
  - Primary/secondary flow options

- [ ] `SortableList.svelte` → Use dnd-kit library
  - Drag-and-drop tab reordering

### Timer Components
- [x] `SpeechTimer.svelte` → Already created
- [ ] `Timer.svelte` → `components/timer/basic-timer.tsx`
- [ ] `Timers.svelte` → `components/timer/timers-panel.tsx`
- [ ] `Time.svelte` → `components/timer/time-display.tsx`
- [ ] `TimerFireworks.svelte` → `components/timer/timer-fireworks.tsx`

### Settings & UI
- [ ] `Settings.svelte` → `components/flow/settings-dialog.tsx`
  - Settings groups
  - Toggle/Radio/Slider controls
  - Reset to defaults
  - Randomize button

- [ ] `Setting.svelte` → `components/flow/setting-item.tsx`
  - Individual setting renderer

- [ ] `Slider.svelte` → `components/flow/slider.tsx`
  - Custom slider with hue support

- [ ] `Radio.svelte` → Use shadcn RadioGroup

- [ ] `Toggle.svelte` → Use shadcn Switch

#### Popups & Dialogs
- [ ] `Popup.svelte` → Use shadcn Dialog
- [ ] `SavedFlows.svelte` → `components/flow/saved-flows.tsx`
- [ ] `SavedFlowsPopup.svelte` → `components/flow/saved-flows-dialog.tsx`
- [ ] `SavedFlow.svelte` → `components/flow/saved-flow-item.tsx`

### Utilities & Models
- [ ] `models/history.ts` → `lib/flow/history.ts`
  - Undo/redo system
  - Action tracking
  - Focus management

- [ ] `models/key.ts` → `hooks/use-keyboard.ts`
  - Keyboard shortcut handling
  - Arrow key navigation

- [ ] `models/autoSave.ts` → Integrated into flow-context
- [ ] `models/file.ts` → `lib/flow/file-operations.ts`
- [ ] `models/sharing.ts` → `lib/flow/sharing.ts`
- [ ] `models/transition.ts` → CSS transitions

### Low Priority (Nice to Have)
- [ ] `DebateDictionary.svelte`
- [ ] `Benefit.svelte`
- [ ] `Tooltip.svelte` → Use shadcn Tooltip
- [ ] `Error.svelte`
- [ ] `Link.svelte`
- [ ] `Shortcut.svelte`
- [ ] `ButtonBar.svelte`
- [ ] `NavTabList.svelte`
- [ ] `TextInput.svelte`
- [ ] `Icon.svelte` → Use lucide-react

### Data Files
- [ ] `dictionary-debate.js` → `lib/flow/dictionary.ts`
- [ ] `final-beep.js` → Integrate audio
- [ ] `main.css` → Convert to Tailwind

## Conversion Strategy

### Phase 1: Core Editor (MVP) 🎯
1. Create basic Flow page layout
2. Implement Box component with editing
3. Add/delete boxes
4. Multiple flow tabs
5. Basic keyboard navigation

### Phase 2: Full Features
1. Complete all Box features (crossing, formatting)
2. Undo/redo system
3. Settings panel
4. Keyboard shortcuts
5. Timer integration

### Phase 3: Advanced Features
1. Drag-and-drop
2. File import/export
3. Saved flows management
4. Sharing functionality
5. Debate dictionary

## Technical Approach

### Svelte → React Conversions

**Svelte Stores** → **React Context + useState**
```typescript
// Svelte
export const flows = writable([]);

// React
const [flows, setFlows] = useState([]);
// + Context for global access
```

**Svelte Reactivity** → **React useEffect**
```typescript
// Svelte
$: palette = flow.invert ? 'accent-secondary' : 'accent';

// React
const palette = useMemo(() =>
  flow.invert ? 'accent-secondary' : 'accent',
  [flow.invert]
);
```

**Svelte Events** → **React Callbacks**
```typescript
// Svelte
<Button on:click={handleClick} />

// React
<Button onClick={handleClick} />
```

**Svelte Bind** → **React Controlled Components**
```typescript
// Svelte
<textarea bind:value={content} />

// React
<textarea value={content} onChange={(e) => setContent(e.target.value)} />
```

### CSS Approach
- Convert CSS custom properties to Tailwind CSS variables
- Use `className` with conditional classes instead of Svelte `class:` directive
- Implement color themes with CSS variables + Tailwind

### Component Library
- Use shadcn/ui components as base (Button, Dialog, Select, etc.)
- Extend with custom Flow-specific components
- Maintain similar visual design

## Testing Plan
- [ ] Box editing and navigation
- [ ] Multiple flows with tabs
- [ ] Settings persistence
- [ ] Auto-save functionality
- [ ] Keyboard shortcuts
- [ ] Timer functionality
- [ ] Import/export flows

## Next Steps
1. Implement Box component with full editing
2. Create Flow display with columns
3. Add MainFlow with tab management
4. Implement keyboard navigation
5. Add Settings dialog
6. Port remaining features incrementally
