"use client"

/**
 * The sidebar's "File manager" dialog: a full-window SVAR file manager over
 * the reader's files and the Topic Starters (see `FileManagerView`). The
 * widget is loaded only when the dialog first opens, so the sidebar, which is
 * on every page, doesn't carry SVAR in its bundle.
 */

import { lazy, Suspense } from "react"
import { Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@debate-ai/ui/primitives/dialog"
import type { FileManagerViewProps } from "./FileManagerView"

const FileManagerView = lazy(() => import("./FileManagerView"))

export interface FileManagerDialogProps extends Omit<FileManagerViewProps, "onDone"> {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FileManagerDialog({ open, onOpenChange, ...props }: FileManagerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-h-[90vh] w-[96vw] !max-w-[96vw] flex-col gap-2 p-3 sm:!max-w-[96vw]">
        <DialogTitle className="pr-8 text-sm">File manager</DialogTitle>
        <DialogDescription className="sr-only">
          Organise your files and folders: open, rename, move, copy, upload and delete. Topic Starters are read-only;
          copy one into your files to edit it.
        </DialogDescription>
        {open && (
          <Suspense
            fallback={
              <div className="flex flex-1 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            }
          >
            <FileManagerView {...props} onDone={() => onOpenChange(false)} />
          </Suspense>
        )}
      </DialogContent>
    </Dialog>
  )
}
