"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type React from "react"
import {
  Loader2,
  Check,
  AlertCircle,
  Save,
  Type,
  Upload,
  Link2,
  ListOrdered,
  ChevronDown,
  Undo2,
  Redo2,
} from "lucide-react"
import { useCallback, useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Bold, Italic, UnderlineIcon, Highlighter } from "lucide-react"
import { cn } from "@/lib/utils"
import { type Editor, useEditorState } from "@tiptap/react"

interface MarkdownToolbarProps {
  editor: Editor
  saveState?: "idle" | "saving" | "saved" | "error"
  onSave?: () => void
  onDiscard?: () => void // Called when user discards changes
  fileName?: string
  hideActions?: boolean // Hide Export/Save (when they're in parent header)
  isBubbleMenu?: boolean // Used in BubbleMenu context
  isFloatingMenu?: boolean // Used in FloatingMenu context
  hasChanges?: boolean // Whether there are unsaved changes
  sandboxId?: string // Sandbox ID for uploading images
}

export function MarkdownToolbar({
  editor,
  saveState = "idle",
  onSave,
  onDiscard,
  fileName = "document",
  hideActions = false,
  isBubbleMenu = false,
  isFloatingMenu = false,
  hasChanges = false,
  sandboxId,
}: MarkdownToolbarProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false)
  const [imageUrl, setImageUrl] = useState("")
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [highlightDropdownOpen, setHighlightDropdownOpen] = useState(false)
  const highlightDropdownRef = useRef<HTMLDivElement>(null)

  const HIGHLIGHT_COLORS = [
    { label: "Yellow", value: "#fef08a" },
    { label: "Green", value: "#bbf7d0" },
    { label: "Blue", value: "#bfdbfe" },
    { label: "Pink", value: "#fbcfe8" },
    { label: "Purple", value: "#e9d5ff" },
    { label: "Orange", value: "#fed7aa" },
    { label: "Red", value: "#fecaca" },
    { label: "Cyan", value: "#a5f3fc" },
  ]

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (highlightDropdownRef.current && !highlightDropdownRef.current.contains(event.target as Node)) {
        setHighlightDropdownOpen(false)
      }
    }
    if (highlightDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [highlightDropdownOpen])

  // Use Tiptap's proper state hooks for reactive state management
  const canUndo = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor) return false
      return editor.can().undo()
    },
  })

  const canRedo = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor) return false
      return editor.can().redo()
    },
  })

  const isBold = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor) return false
      return editor.isActive("bold")
    },
  })

  const isItalic = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor) return false
      return editor.isActive("italic")
    },
  })

  const isUnderline = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor) return false
      return editor.isActive("underline")
    },
  })

  const isStrike = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor) return false
      return editor.isActive("strike")
    },
  })

  const isCode = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor) return false
      return editor.isActive("code")
    },
  })

  const isOrderedList = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor) return false
      return editor.isActive("orderedList")
    },
  })

  const isBlockquote = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor) return false
      return editor.isActive("blockquote")
    },
  })

  const isCodeBlock = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor) return false
      return editor.isActive("codeBlock")
    },
  })

  const isLink = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor) return false
      return editor.isActive("link")
    },
  })

  const isInTable = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor) return false
      return editor.isActive("table")
    },
  })

  const isHighlight = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor) return false
      return editor.isActive("highlight")
    },
  })

  const currentHeading = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor) return "Normal"
      if (editor.isActive("heading", { level: 1 })) return "Heading 1"
      if (editor.isActive("heading", { level: 2 })) return "Heading 2"
      if (editor.isActive("heading", { level: 3 })) return "Heading 3"
      if (editor.isActive("heading", { level: 4 })) return "Heading 4"
      return "Normal"
    },
  })

  const wordCount = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor) return 0
      return editor.storage.characterCount?.words() || 0
    },
  })

  const currentHighlightColor = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor) return null
      const { color } = editor.getAttributes("highlight")
      return color || HIGHLIGHT_COLORS[0].value
    },
  })

  const handleExport = useCallback(
    async (format: any) => {
      if (!editor) return

      setIsExporting(true)
      try {
        const content = editor.getHTML()
      } catch (error) {
        console.error("Export error:", error)
      } finally {
        setIsExporting(false)
      }
    },
    [editor, fileName],
  )

  const ToolbarButton = ({
    onClick,
    isActive,
    disabled,
    icon: Icon,
    tooltip,
    shortcut,
  }: {
    onClick: () => void
    isActive?: boolean
    disabled?: boolean
    icon: React.ElementType
    tooltip: string
    shortcut?: string
  }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          onClick={onClick}
          disabled={disabled}
          variant="ghost"
          size="sm"
          className={cn("h-8 w-8 p-0", isActive && "bg-accent text-accent-foreground")}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="flex items-center gap-2">
        <span>{tooltip}</span>
        {shortcut && (
          <kbd className="px-1.5 py-0.5 text-[10px] bg-slate-700 dark:bg-slate-300 text-white dark:text-slate-900 rounded font-mono border border-slate-600 dark:border-slate-400">
            {shortcut}
          </kbd>
        )}
      </TooltipContent>
    </Tooltip>
  )

  const insertLink = useCallback(() => {
    const previousUrl = editor.getAttributes("link").href
    const url = window.prompt("Enter URL:", previousUrl)
    if (url === null) return
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run()
  }, [editor])

  const openImageDialog = useCallback(() => {
    setImageUrl("")
    setImagePreview(null)
    setSelectedFile(null)
    setIsImageDialogOpen(true)
  }, [])

  const handleImageFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith("image/")) {
      // Store the file for upload
      setSelectedFile(file)
      setImageUrl("") // Clear URL when file is selected

      // Create preview
      const reader = new FileReader()
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string
        setImagePreview(dataUrl)
      }
      reader.readAsDataURL(file)
    }
  }, [])

  const insertTable = useCallback(() => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }, [editor])

  // Table control functions
  const addRowBefore = useCallback(() => {
    editor.chain().focus().addRowBefore().run()
  }, [editor])

  const addRowAfter = useCallback(() => {
    editor.chain().focus().addRowAfter().run()
  }, [editor])

  const addColumnBefore = useCallback(() => {
    editor.chain().focus().addColumnBefore().run()
  }, [editor])

  const addColumnAfter = useCallback(() => {
    editor.chain().focus().addColumnAfter().run()
  }, [editor])

  const deleteRow = useCallback(() => {
    editor.chain().focus().deleteRow().run()
  }, [editor])

  const deleteColumn = useCallback(() => {
    editor.chain().focus().deleteColumn().run()
  }, [editor])

  const deleteTable = useCallback(() => {
    editor.chain().focus().deleteTable().run()
  }, [editor])

  const SaveButton = () => {
    if (!onSave) return null

    switch (saveState) {
      case "saving":
        return (
          <Button variant="ghost" size="sm" disabled className="gap-1.5 h-8 px-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs">Saving</span>
          </Button>
        )
      case "saved":
        return (
          <Button variant="ghost" size="sm" disabled className="gap-1.5 h-8 px-2 text-green-600">
            <Check className="h-4 w-4" />
            <span className="text-xs">Saved</span>
          </Button>
        )
      case "error":
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSave}
            className="gap-1.5 h-8 px-2 text-red-500 hover:bg-red-50 hover:text-red-600"
          >
            <AlertCircle className="h-4 w-4" />
            <span className="text-xs">Retry</span>
          </Button>
        )
      default:
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={onSave} disabled={!hasChanges} className="gap-1.5 h-8 px-2">
                <Save className="h-4 w-4" />
                <span className="text-xs">Save</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {hasChanges ? (
                <>
                  Save changes{" "}
                  <kbd className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-slate-700 dark:bg-slate-300 text-white dark:text-slate-900 rounded font-mono border border-slate-600 dark:border-slate-400">
                    ⌘S
                  </kbd>
                </>
              ) : (
                "No changes to save"
              )}
            </TooltipContent>
          </Tooltip>
        )
    }
  }

  const TextStyleDropdown = () => {
    const getActiveStyle = () => {
      if (editor.isActive("heading", { level: 1 })) return "Heading 1"
      if (editor.isActive("heading", { level: 2 })) return "Heading 2"
      if (editor.isActive("heading", { level: 3 })) return "Heading 3"
      if (editor.isActive("heading", { level: 4 })) return "Heading 4"
      return "Normal"
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 px-2 gap-1">
            <Type className="h-4 w-4" />
            <span className="text-xs">{getActiveStyle()}</span>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => editor.chain().focus().setParagraph().run()}>Normal</DropdownMenuItem>
          <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
            Heading 1
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            Heading 2
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
            Heading 3
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}>
            Heading 4
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  const toolbarContent = (
    <>
      {/* Auto-save status indicator - Left side, only in main toolbar */}
      {!isBubbleMenu &&
        !isFloatingMenu &&
        (saveState === "saving" || saveState === "saved" || saveState === "error") && (
          <>
            <div className="flex items-center gap-1 shrink-0">
              {saveState === "saving" && (
                <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span className="font-medium">Saving...</span>
                </div>
              )}
              {saveState === "saved" && (
                <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-500 px-2 py-1 bg-green-50 dark:bg-green-900/20 rounded-md">
                  <Check className="h-3 w-3" />
                  <span className="font-medium">Saved</span>
                </div>
              )}
              {saveState === "error" && (
                <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-500 px-2 py-1 bg-red-50 dark:bg-red-900/20 rounded-md">
                  <AlertCircle className="h-3 w-3" />
                  <span className="font-medium">Error</span>
                </div>
              )}
            </div>
          </>
        )}

      {/* Highlighter dropdown */}
      <div className="flex items-center shrink-0">
        <div ref={highlightDropdownRef} className="relative">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={editor.isActive("highlight") ? "default" : "ghost"}
                size="sm"
                className="h-8 gap-1 px-2"
                onClick={() => setHighlightDropdownOpen(!highlightDropdownOpen)}
              >
                <div className="flex items-center gap-1">
                  <Highlighter
                    className="h-4 w-4"
                    style={{
                      color: editor.isActive("highlight")
                        ? currentHighlightColor || HIGHLIGHT_COLORS[0].value
                        : undefined,
                    }}
                  />
                  <ChevronDown className="h-3 w-3" />
                </div>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Highlight</p>
            </TooltipContent>
          </Tooltip>

          {highlightDropdownOpen && (
            <div className="absolute left-0 top-full mt-1 z-50 min-w-[140px] rounded-md border bg-popover p-1 shadow-md">
              {HIGHLIGHT_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                  onClick={() => {
                    editor.chain().focus().setHighlight({ color: color.value }).run()
                    setHighlightDropdownOpen(false)
                  }}
                >
                  <div className="w-4 h-4 rounded border border-border" style={{ backgroundColor: color.value }} />
                  <span>{color.label}</span>
                </button>
              ))}
              <div className="my-1 h-px bg-border" />
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent"
                onClick={() => {
                  editor.chain().focus().unsetHighlight().run()
                  setHighlightDropdownOpen(false)
                }}
              >
                Remove highlight
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Text formatting */}
      <div className="flex items-center gap-0.5">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
          icon={Bold}
          tooltip="Bold"
          shortcut="⌘B"
        />
        {!isBubbleMenu && (
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive("italic")}
            icon={Italic}
            tooltip="Italic"
            shortcut="⌘I"
          />
        )}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive("underline")}
          icon={UnderlineIcon}
          tooltip="Underline"
          shortcut="⌘U"
        />
      </div>

      {/* Heading buttons */}
      {!isBubbleMenu && (
        <>
          <TextStyleDropdown />
        </>
      )}

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive("orderedList")}
        icon={ListOrdered}
        tooltip="Numbered list"
      />

      {/* Undo/Redo */}
      {!isBubbleMenu && (
        <>
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!canUndo}
            icon={Undo2}
            tooltip="Undo"
            shortcut="⌘Z"
          />
          <ToolbarButton
            onClick={() => {
              editor.chain().focus().redo().run()
            }}
            disabled={!canRedo}
            icon={Redo2}
            tooltip="Redo"
            shortcut="⌘⇧Z"
          />
        </>
      )}

      {isBubbleMenu && <TextStyleDropdown />}
    </>
  )

  // Image Dialog
  const imageDialog = (
    <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Insert Image</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="url" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload" className="gap-1.5 opacity-50 cursor-not-allowed" disabled>
              <Upload className="h-4 w-4" />
              Upload
              <span className="text-[10px] ml-1">(Soon)</span>
            </TabsTrigger>
            <TabsTrigger value="url" className="gap-1.5">
              <Link2 className="h-4 w-4" />
              URL
            </TabsTrigger>
          </TabsList>
          <TabsContent value="upload" className="space-y-4 pt-4">
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                "hover:border-primary hover:bg-muted/50",
                imagePreview && "border-primary bg-muted/50",
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageFileSelect}
              />
              {imagePreview ? (
                <div className="space-y-3">
                  <img
                    src={imagePreview || "/placeholder.svg"}
                    alt="Preview"
                    className="max-h-40 mx-auto rounded-lg object-contain"
                  />
                  <p className="text-sm text-muted-foreground">Click to change image</p>
                  {sandboxId && (
                    <p className="text-xs text-green-600 dark:text-green-400">Will be uploaded to workspace</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-sm font-medium">Click to upload an image</p>
                  <p className="text-xs text-muted-foreground">PNG, JPG, GIF up to 50MB</p>
                  {sandboxId && (
                    <p className="text-xs text-green-600 dark:text-green-400">Image will be uploaded to workspace</p>
                  )}
                </div>
              )}
            </div>
          </TabsContent>
          <TabsContent value="url" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="image-url">Image URL</Label>
              <Input
                id="image-url"
                placeholder="https://example.com/image.png"
                value={imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value)
                  setImagePreview(null) // Clear preview when URL is entered
                }}
              />
            </div>
            {imageUrl && (
              <div className="border rounded-lg p-2">
                <img
                  src={imageUrl || "/placeholder.svg"}
                  alt="Preview"
                  className="max-h-40 mx-auto rounded object-contain"
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).style.display = "none"
                  }}
                />
              </div>
            )}
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsImageDialogOpen(false)} disabled={isUploading}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  // For bubble/floating menus, return just the content without wrapper
  if (isBubbleMenu || isFloatingMenu) {
    return (
      <TooltipProvider delayDuration={300}>
        <div className="flex items-center gap-1">{toolbarContent}</div>
      </TooltipProvider>
    )
  }

  // Main toolbar with full wrapper
  return (
    <TooltipProvider delayDuration={300}>
      <div className="border-b bg-background sticky top-0 z-10">
        <div className="px-2 py-1.5 flex items-center gap-0.5 overflow-visible scrollbar-none">{toolbarContent}</div>
      </div>
      {imageDialog}
    </TooltipProvider>
  )
}
