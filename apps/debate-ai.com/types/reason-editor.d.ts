declare module "reason-editor" {
  import type { ComponentType, ReactNode } from "react"

  export interface ToolbarCustomization {
    hide?: string[]
    order?: string[]
    children?: ReactNode
  }

  export interface EditorProps {
    children?: ReactNode
    toolbar?: ToolbarCustomization
  }

  export const EditorWithToolbar: ComponentType<EditorProps>
  export const EditorContent: ComponentType<EditorProps>
  const Editor: ComponentType<EditorProps>
  export default Editor
}
