"use client"

import * as React from "react"
import {
  Undo,
  Redo,
  FolderOpen,
  FilePlus,
  Save,
  SaveOff,
  Mic,
  MicOff,
  Send,
  Search,
  Tag,
  Settings,
  Plus,
  Type,
  Underline,
  Highlighter,
  Eraser,
  Palette,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  List,
  FileText,
  BookOpen,
  MessageSquare,
  PlusCircle,
  StickyNote,
  Layers,
  Sparkles,
  HelpCircle,
  Timer,
  Minus,
  RotateCcw,
  GripVertical,
  Bold,
  Italic,
  Strikethrough,
  Superscript,
  Subscript,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Code,
  Link,
  Image,
  Table,
  Scissors,
  Copy,
  Paste,
  Redo2,
  Undo2,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Maximize,
  Minimize,
  LayoutGrid,
  Columns,
  Rows,
  Grid,
  Zap,
  Brain,
  Translate,
  Wrench,
  SearchCheck,
  Link2,
  Triangle,
  Square,
  Circle,
  Diamond,
  Hexagon,
  Octagon,
  Pentagon,
  Star,
  Flag,
  Bookmark,
  Heart,
  Bell,
  Lightbulb,
  Rocket,
  Target,
  Globe,
  Calendar,
  Mail,
  Camera,
  Music,
  Shield,
  Lock,
  Key,
  Sun,
  Moon,
  Smile,
  ThumbsUp,
  Trophy,
  Gift,
  Puzzle,
  Filter,
  Tool,
  Pin,
  Coins,
  Archive,
  Infinity,
  Anchor,
  Hash,
  Compass,
  Navigation,
  Menu,
  X,
  Check,
  AlertCircle,
  Info,
  AlertTriangle,
  RefreshCw,
  Download,
  Upload,
  Printer,
  FileText as FileTextIcon,
  FilePlus as FilePlusIcon,
  FileMinus,
  FileSearch,
  FileEdit,
  FileLock,
  FileKey,
  FileQuestion,
  FileWarning,
  FileCheck,
  FileX,
  FileSlash,
  FileSymlink,
  FileType,
  FileCode,
  FileJson,
  FileCsv,
  FileAudio,
  FileVideo,
  FileImage,
  FilePdf,
  FileSpreadsheet,
  FilePresentation,
  FileArchive,
  FileSignature,
  FileKey2,
  FileLock2,
  FileWarning2,
  FileCheck2,
  FileX2,
  FileMinus2,
  FilePlus2,
  FileSearch2,
  FileEdit2,
  FileType2,
  FileCode2,
  FileJson2,
  FileCsv2,
  FileAudio2,
  FileVideo2,
  FileImage2,
  FilePdf2,
  FileSpreadsheet2,
  FilePresentation2,
  FileArchive2,
  FileSignature2,
  FileLock3,
  FileKey3,
  FileQuestion2,
  FileWarning3,
  FileCheck3,
  FileX3,
  FileMinus3,
  FilePlus3,
  FileSearch3,
  FileEdit3,
  FileType3,
  FileCode3,
  FileJson3,
  FileCsv3,
  FileAudio3,
  FileVideo3,
  FileImage3,
  FilePdf3,
  FileSpreadsheet3,
  FilePresentation3,
  FileArchive3,
  FileSignature3,
} from "lucide-react"

import { Button } from "./button"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "./tooltip"
import { cn } from "../lib/utils"

const TOOLTIP_DELAY = 0

interface ToolbarButtonProps {
  id: string
  icon: React.ReactNode
  label: string
  shortcut?: string
  description?: string
  onClick?: () => void
  disabled?: boolean
  "aria-pressed"?: boolean
  variant?: "ghost" | "outline" | "secondary" | "default" | "destructive"
  size?: "icon" | "icon-sm" | "icon-lg" | "sm" | "default" | "lg"
  className?: string
}

function ToolbarButton({
  id,
  icon,
  label,
  shortcut,
  description,
  onClick,
  disabled,
  "aria-pressed": ariaPressed,
  variant = "ghost",
  size = "icon",
  className,
}: ToolbarButtonProps) {
  const tooltipContent = (
    <div className="flex flex-col gap-1">
      <span className="font-medium">{label}</span>
      {shortcut && (
        <span className="text-xs text-muted-foreground font-mono px-1.5 py-0.5 rounded bg-accent">
          {shortcut}
        </span>
      )}
      {description && (
        <span className="text-xs text-muted-foreground max-w-[200px]">{description}</span>
      )}
    </div>
  )

  return (
    <TooltipProvider delayDuration={TOOLTIP_DELAY}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            id={id}
            variant={variant}
            size={size}
            onClick={onClick}
            disabled={disabled}
            aria-pressed={ariaPressed}
            className={cn("relative", className)}
            data-slot="toolbar-button"
          >
            {icon}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="center">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface ToolbarDropdownProps {
  id: string
  label: string
  icon: React.ReactNode
  shortcut?: string
  description?: string
  children: React.ReactNode
  className?: string
}

function ToolbarDropdown({
  id,
  label,
  icon,
  shortcut,
  description,
  children,
  className,
}: ToolbarDropdownProps) {
  const tooltipContent = (
    <div className="flex flex-col gap-1">
      <span className="font-medium">{label}</span>
      {shortcut && (
        <span className="text-xs text-muted-foreground font-mono px-1.5 py-0.5 rounded bg-accent">
          {shortcut}
        </span>
      )}
      {description && (
        <span className="text-xs text-muted-foreground max-w-[200px]">{description}</span>
      )}
    </div>
  )

  return (
    <TooltipProvider delayDuration={TOOLTIP_DELAY}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            id={id}
            variant="ghost"
            size="icon"
            className={cn("relative", className)}
            data-slot="toolbar-dropdown-trigger"
            aria-haspopup="true"
            aria-expanded="false"
          >
            {icon}
            <ChevronDown className="size-3 ml-1" aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="center">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function Toolbar() {
  return (
    <header id="ribbon" className="dec-ribbon" role="toolbar" aria-label="Editor toolbar">
      <div id="ribbon-strip" className="ribbon-strip flex h-10 items-center gap-1 border-b border-border bg-background px-1 overflow-x-auto">
        <section className="ribbon-section ribbon-left flex items-center gap-1" aria-label="Primary actions">
          <div id="undo-redo-stack" className="ribbon-button-stack flex items-center gap-0.5" role="group" aria-label="Undo/Redo">
            <ToolbarButton
              id="undo-btn"
              icon={<Undo2 className="size-4" />}
              label="Undo"
              shortcut="⌘Z"
              description="Undo the last action"
            />
            <ToolbarButton
              id="redo-btn"
              icon={<Redo2 className="size-4" />}
              label="Redo"
              shortcut="⌘⇧Z"
              description="Redo the last undone action"
            />
          </div>

          <div id="file-stack" className="ribbon-button-stack flex items-center gap-0.5" role="group" aria-label="File operations">
            <ToolbarButton
              id="open-btn"
              icon={<FolderOpen className="size-4" />}
              label="Open Document"
              shortcut="⌘O"
              description="Open an existing document"
            />
            <ToolbarButton
              id="new-btn"
              icon={<FilePlusIcon className="size-4" />}
              label="New Document"
              shortcut="⌘N"
              description="Create a new document"
            />
            <ToolbarButton
              id="export-btn"
              icon={<Save className="size-4" />}
              label="Save"
              shortcut="⌘S"
              description="Save the current document"
              disabled
            />
            <ToolbarButton
              id="autosave-btn"
              icon={<SaveOff className="size-4" />}
              label="Toggle Autosave"
              shortcut="—"
              description="Enable or disable automatic saving"
              ariaPressed={false}
            />
          </div>

          <div id="speech-stack" className="ribbon-button-stack flex items-center gap-0.5" role="group" aria-label="Speech document">
            <ToolbarButton
              id="speech-new-btn"
              icon={<FilePlusIcon className="size-4" />}
              label="New Speech Document"
              description="Create a new speech document"
            />
            <ToolbarButton
              id="speech-mark-btn"
              icon={<Mic className="size-4" />}
              label="Mark as Speech Document"
              description="Mark or unmark the active document as the speech document"
              ariaPressed={false}
            />
            <ToolbarButton
              id="speech-send-cursor-btn"
              icon={<Send className="size-4" />}
              label="Send to Speech at Cursor"
              shortcut="`"
              description="Send selected content to speech document at cursor position"
            />
            <ToolbarButton
              id="speech-send-end-btn"
              icon={<Send className="size-4" />}
              label="Send to Speech at End"
              shortcut="⌥`"
              description="Send selected content to speech document at end"
            />
          </div>

          <div id="quickcards-stack" className="ribbon-button-stack flex items-center gap-0.5" role="group" aria-label="Quick Cards">
            <ToolbarButton
              id="qc-search-btn"
              icon={<Search className="size-4" />}
              label="Toggle Command Bar"
              shortcut="⌘P"
              description="Open the command palette to search everything"
            />
            <ToolbarButton
              id="qc-tagpicker-btn"
              icon={<Tag className="size-4" />}
              label="Filter Quick Cards by Tag"
              description="Filter quick cards by tag"
            />
            <ToolbarButton
              id="qc-manage-btn"
              icon={<Settings className="size-4" />}
              label="Manage Quick Cards"
              description="Manage your quick card library"
            />
            <ToolbarButton
              id="qc-add-btn"
              icon={<Plus className="size-4" />}
              label="Add Quick Card"
              description="Add a quick card from the current selection"
            />
          </div>

          <div id="formatting-panel" className="ribbon-formatting-panel flex items-center gap-0.5" role="group" aria-label="Heading styles">
            <ToolbarButton
              id="style-pocket-btn"
              icon={<Type className="size-4" />}
              label="Pocket Style"
              shortcut="F4"
              description="Apply Pocket heading style"
              variant="outline"
              size="sm"
              className="formatting-panel-pocket"
            />
            <ToolbarButton
              id="style-tag-btn"
              icon={<Tag className="size-4" />}
              label="Tag Style"
              shortcut="F7"
              description="Apply Tag style"
              variant="outline"
              size="sm"
              className="formatting-panel-tag"
            />
            <ToolbarButton
              id="style-hat-btn"
              icon={<BookOpen className="size-4" />}
              label="Hat Style"
              shortcut="F5"
              description="Apply Hat heading style"
              variant="outline"
              size="sm"
              className="formatting-panel-hat"
            />
            <ToolbarButton
              id="style-block-btn"
              icon={<LayoutGrid className="size-4" />}
              label="Block Style"
              shortcut="F6"
              description="Apply Block heading style"
              variant="outline"
              size="sm"
              className="formatting-panel-block"
            />
            <ToolbarButton
              id="style-analytic-btn"
              icon={<Brain className="size-4" />}
              label="Analytic Style"
              shortcut="⌘F7"
              description="Apply Analytic style"
              variant="outline"
              size="sm"
              className="formatting-panel-analytic"
            />
            <ToolbarButton
              id="style-undertag-btn"
              icon={<StickyNote className="size-4" />}
              label="Undertag Style"
              shortcut="⌘F8"
              description="Apply Undertag style"
              variant="outline"
              size="sm"
              className="formatting-panel-undertag"
            />
          </div>

          <div id="cite-panel" className="ribbon-cite-panel flex items-center gap-0.5" role="group" aria-label="Inline marks">
            <ToolbarButton
              id="cite-btn"
              icon={<Quote className="size-4" />}
              label="Cite"
              shortcut="F8"
              description="Apply Cite style to selection"
              variant="outline"
              size="sm"
              className="formatting-panel-cite"
            />
            <ToolbarButton
              id="underline-btn"
              icon={<Underline className="size-4" />}
              label="Underline"
              shortcut="F9"
              description="Toggle underline on selection"
              variant="outline"
              size="sm"
              className="formatting-panel-underline"
            />
            <ToolbarButton
              id="emphasis-btn"
              icon={<Italic className="size-4" />}
              label="Emphasis"
              shortcut="F10"
              description="Apply Emphasis style"
              variant="outline"
              size="sm"
              className="formatting-panel-emphasis"
            />
            <ToolbarButton
              id="normal-btn"
              icon={<Eraser className="size-4" />}
              label="Clear Formatting"
              shortcut="F12"
              description="Clear all formatting from selection"
              variant="outline"
              size="sm"
              className="formatting-panel-normal"
            />
          </div>

          <div id="color-panel" className="ribbon-color-panel flex items-center gap-0.5" role="group" aria-label="Colors">
            <div className="ribbon-color-control flex items-center gap-0.5" data-control="highlight">
              <ToolbarButton
                id="highlight-btn"
                icon={<Highlighter className="size-4" />}
                label="Highlight"
                shortcut="F11"
                description="Toggle highlight on selection"
                variant="outline"
                size="icon"
                className="ribbon-color-main"
              />
              <ToolbarDropdown
                id="highlight-picker-btn"
                label="Highlight Color"
                icon={<ChevronDown className="size-4" />}
                description="Choose highlight color"
                className="ribbon-color-arrow"
              >
                <div className="p-2">Color picker content</div>
              </ToolbarDropdown>
            </div>
            <div className="ribbon-color-control flex items-center gap-0.5" data-control="shading">
              <ToolbarButton
                id="shading-btn"
                icon={<Square className="size-4" />}
                label="Background Color"
                shortcut="⌘F11"
                description="Toggle background color on selection"
                variant="outline"
                size="icon"
                className="ribbon-color-main"
              />
              <ToolbarDropdown
                id="shading-picker-btn"
                label="Background Color Picker"
                icon={<ChevronDown className="size-4" />}
                description="Choose background color"
                className="ribbon-color-arrow"
              >
                <div className="p-2">Color picker content</div>
              </ToolbarDropdown>
            </div>
            <div className="ribbon-color-control flex items-center gap-0.5" data-control="fontcolor">
              <ToolbarButton
                id="fontcolor-btn"
                icon={<Type className="size-4" />}
                label="Font Color"
                description="Change font color"
                variant="outline"
                size="icon"
                className="ribbon-color-main"
              />
              <ToolbarDropdown
                id="fontcolor-picker-btn"
                label="Font Color Picker"
                icon={<ChevronDown className="size-4" />}
                description="Choose font color"
                className="ribbon-color-arrow"
              >
                <div className="p-2">Color picker content</div>
              </ToolbarDropdown>
            </div>
            <div className="ribbon-color-control ribbon-font-size-control flex items-center gap-0.5" data-control="fontsize">
              <input
                id="font-size-input"
                className="ribbon-font-size-input w-16 text-center text-xs border rounded bg-background"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                spellCheck={false}
                aria-label="Font size at cursor"
                placeholder="Size"
              />
              <ToolbarDropdown
                id="font-size-picker-btn"
                label="Font Size Picker"
                icon={<ChevronDown className="size-4" />}
                description="Choose font size"
                className="ribbon-color-arrow"
              >
                <div className="p-2">Font size picker content</div>
              </ToolbarDropdown>
            </div>
            <ToolbarButton
              id="font-size-up-btn"
              icon={<ChevronUp className="size-4" />}
              label="Increase Font Size"
              description="Increase font size by 1pt"
              variant="outline"
              size="icon"
              className="ribbon-font-size-step"
            />
            <ToolbarButton
              id="font-size-down-btn"
              icon={<ChevronDown className="size-4" />}
              label="Decrease Font Size"
              description="Decrease font size by 1pt"
              variant="outline"
              size="icon"
              className="ribbon-font-size-step"
            />
          </div>

          <div id="doc-menu-panel" className="ribbon-doc-menu-panel flex items-center gap-0.5" role="group" aria-label="Document utilities">
            <ToolbarDropdown
              id="doc-menu-btn"
              label="Document Utilities"
              icon={<FileTextIcon className="size-4" />}
              description="Document utilities menu"
            >
              <div className="p-2">Document menu content</div>
            </ToolbarDropdown>
            <ToolbarDropdown
              id="card-menu-btn"
              label="Card Utilities"
              icon={<Layers className="size-4" />}
              description="Card utilities menu"
            >
              <div className="p-2">Card menu content</div>
            </ToolbarDropdown>
          </div>

          <div id="numbering-panel" className="ribbon-numbering-panel flex items-center gap-0.5" role="group" aria-label="Card numbering">
            <ToolbarButton
              id="num-role-btn"
              icon={<List className="size-4" />}
              label="Number This Card"
              shortcut="⌘⌥1"
              description="Toggle numbering role for this card"
              variant="outline"
              size="icon"
              ariaPressed={false}
            />
            <ToolbarButton
              id="num-sub-role-btn"
              icon={<List className="size-4" />}
              label="Mark as Substructure"
              shortcut="⌘⌥2"
              description="Toggle substructure role"
              variant="outline"
              size="icon"
              ariaPressed={false}
            />
            <ToolbarButton
              id="num-restart-btn"
              icon={<RotateCcw className="size-4" />}
              label="Restart Numbering"
              shortcut="⌘⌥3"
              description="Restart numbering from this card"
              variant="outline"
              size="icon"
              ariaPressed={false}
            />
            <ToolbarButton
              id="num-visibility-btn"
              icon={<Eye className="size-4" />}
              label="Show/Hide Card Numbering"
              description="Toggle visibility of card numbering"
              variant="outline"
              size="icon"
              ariaPressed={true}
            />
          </div>

          <div id="doc-ops-panel" className="ribbon-doc-ops-panel flex items-center gap-0.5" role="group" aria-label="Document operations">
            <ToolbarButton
              id="paragraph-integrity-btn"
              icon={<AlignLeft className="size-4" />}
              label="Paragraph Integrity"
              description="Toggle paragraph integrity"
              variant="outline"
              size="icon"
              ariaPressed={true}
            />
            <ToolbarButton
              id="plain-paste-toggle-btn"
              icon={<ClipboardCheck className="size-4" />}
              label="Paste as Plain Text"
              shortcut="F2"
              description="Paste clipboard content as unformatted text"
              variant="outline"
              size="icon"
              ariaPressed={false}
            />
          </div>

          <div id="view-ops-panel" className="ribbon-doc-ops-panel flex items-center gap-0.5" role="group" aria-label="View tools">
            <ToolbarButton
              id="read-mode-btn"
              icon={<EyeOff className="size-4" />}
              label="Read Mode"
              description="Toggle read mode"
              variant="outline"
              size="icon"
            />
            <ToolbarButton
              id="reader-view-btn"
              icon={<BookOpen className="size-4" />}
              label="Reading View"
              description="Toggle reading view"
              variant="outline"
              size="icon"
            />
          </div>

          <div id="comments-ops-panel" className="ribbon-doc-ops-panel flex items-center gap-0.5" role="group" aria-label="Comments">
            <ToolbarButton
              id="comments-toggle-btn"
              icon={<MessageSquare className="size-4" />}
              label="Show/Hide Comments"
              description="Toggle comments visibility"
              variant="outline"
              size="icon"
              ariaPressed={false}
            />
            <ToolbarButton
              id="comments-add-btn"
              icon={<PlusCircle className="size-4" />}
              label="Add Comment"
              description="Add a comment on the selection"
              variant="outline"
              size="icon"
            />
            <ToolbarButton
              id="add-note-btn"
              icon={<StickyNote className="size-4" />}
              label="Add Note"
              shortcut="⌘⇧N"
              description="Add a private note on the selection"
              variant="outline"
              size="icon"
            />
            <ToolbarButton
              id="manage-flashcards-btn"
              icon={<Layers className="size-4" />}
              label="Manage Flashcards"
              description="Manage your flashcard collection"
              variant="outline"
              size="icon"
            />
            <ToolbarButton
              id="create-flashcard-btn"
              icon={<Sparkles className="size-4" />}
              label="Create Flashcard"
              description="Create a flashcard from the selection"
              variant="outline"
              size="icon"
            />
            <ToolbarButton
              id="ask-ai-btn"
              icon={<Brain className="size-4" />}
              label="Ask AI"
              shortcut="⌘⇧Q"
              description="Ask AI about the selection"
              variant="outline"
              size="icon"
              className="hidden"
            />
          </div>

          <div id="custom-ribbon-panel" className="ribbon-doc-ops-panel flex items-center gap-0.5 hidden" role="group" aria-label="Custom buttons" />
        </section>

        <section className="ribbon-section ribbon-right flex items-center gap-1" aria-label="Right toolbar">
          <div className="ribbon-right-grid flex items-center gap-0.5">
            <ToolbarButton
              id="reference-btn"
              icon={<HelpCircle className="size-4" />}
              label="Keyboard Shortcuts"
              description="Open keyboard shortcuts reference"
            />
            <ToolbarButton
              id="settings-btn"
              icon={<Settings className="size-4" />}
              label="Settings"
              description="Open settings"
              className="hidden"
            />
            <ToolbarButton
              id="timer-toggle-btn"
              icon={<Timer className="size-4" />}
              label="Toggle Timer Panel"
              description="Show or hide the timer panel"
              ariaPressed={false}
            />
          </div>
        </section>

        <section className="ribbon-section ribbon-center flex-1 flex items-center justify-center" aria-label="Document name">
          <div id="doc-name-chip" className="pmd-doc-name-chip hidden" role="status">
            <span id="doc-name-chip-text" className="pmd-doc-name-chip-text" />
          </div>
        </section>
      </div>
    </header>
  )
}

import { Quote, ClipboardCheck } from "lucide-react"