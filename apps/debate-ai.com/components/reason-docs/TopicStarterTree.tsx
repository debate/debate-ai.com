"use client"

import { type ReactNode, useMemo, useState } from "react"
import { ChevronDown, ChevronRight, FileText, Folder, Search } from "lucide-react"
import { Input } from "@/lib/ui/primitives/input"
import { cn } from "@/lib/ui/lib/utils"

export interface TopicStarterItem { id: number; title: string; content: string; parentId: number | null; isFolder: boolean; tags: string }
interface Node { item: TopicStarterItem; children: Node[] }
function tree(items: TopicStarterItem[]) {
  const children = new Map<number | null, TopicStarterItem[]>()
  items.forEach((item) => children.set(item.parentId, [...(children.get(item.parentId) ?? []), item]))
  const make = (parentId: number | null): Node[] => (children.get(parentId) ?? []).sort((a, b) => Number(b.isFolder) - Number(a.isFolder) || a.title.localeCompare(b.title)).map((item) => ({ item, children: make(item.id) }))
  return make(null)
}
export function TopicStarterTree({ items, onSelect }: { items: TopicStarterItem[]; onSelect: (item: TopicStarterItem) => void }) {
  const [query, setQuery] = useState("")
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set(items.filter((item) => item.isFolder).map((item) => item.id)))
  const nodes = useMemo(() => tree(items), [items])
  const term = query.trim().toLowerCase()
  const render = (node: Node, depth: number): ReactNode => {
    const tags = (() => { try { return JSON.parse(node.item.tags) as string[] } catch { return [] } })()
    const matches = !term || `${node.item.title} ${tags.join(" ")}`.toLowerCase().includes(term)
    const childMatches = node.children.some((child) => JSON.stringify(child).toLowerCase().includes(term))
    if (!matches && !childMatches) return null
    const open = expanded.has(node.item.id) || Boolean(term)
    return <div key={node.item.id}>
      <button type="button" onClick={() => node.item.isFolder ? setExpanded((old) => { const next = new Set(old); next.has(node.item.id) ? next.delete(node.item.id) : next.add(node.item.id); return next }) : onSelect(node.item)} className="flex w-full items-center gap-1 rounded px-2 py-1.5 text-left text-sm hover:bg-muted" style={{ paddingLeft: 8 + depth * 14 }}>
        {node.item.isFolder ? (open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />) : <span className="w-3.5" />}
        {node.item.isFolder ? <Folder className="h-4 w-4 text-amber-500" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
        <span className="min-w-0 flex-1 truncate">{node.item.title}</span>
        {!node.item.isFolder && tags.slice(0, 1).map((tag) => <span key={tag} className="rounded bg-muted px-1 text-[10px] text-muted-foreground">{tag}</span>)}
      </button>
      {node.item.isFolder && open && node.children.map((child) => render(child, depth + 1))}
    </div>
  }
  return <div className="flex min-h-0 flex-1 flex-col border-t">
    <div className="relative m-2"><Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-8 pl-7 text-xs" placeholder="Search topic files" /></div>
    <div className="min-h-0 flex-1 overflow-auto pb-2">{nodes.map((node) => render(node, 0))}{items.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">No public topic starters yet.</p>}</div>
  </div>
}
