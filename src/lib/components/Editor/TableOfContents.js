import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'

export const TableOfContentsExtension = Extension.create({
  name: 'tableOfContents',

  addOptions() {
    return {
      onUpdate: () => {},
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('tableOfContents'),
        view: () => ({
          update: (view) => {
            const headings = []
            view.state.doc.descendants((node, pos) => {
              if (node.type.name === 'heading') {
                headings.push({
                  level: node.attrs.level,
                  text: node.textContent,
                  pos
                })
              }
            })
            this.options.onUpdate(headings)
          }
        })
      })
    ]
  }
})