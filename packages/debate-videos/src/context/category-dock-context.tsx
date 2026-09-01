"use client"

import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from "react"
import type { CategoryType } from "../types/videos"

interface CategoryState {
  currentCategory: CategoryType
  onCategoryChange: (category: CategoryType) => void
}

interface CategoryDockContextValue {
  categoryState: CategoryState | null
  register: (state: CategoryState) => void
  unregister: () => void
  sidebarExtra: ReactNode | null
  setSidebarExtra: (node: ReactNode | null) => void
}

const CategoryDockContext = createContext<CategoryDockContextValue>({
  categoryState: null,
  register: () => {},
  unregister: () => {},
  sidebarExtra: null,
  setSidebarExtra: () => {},
})

export function CategoryDockProvider({ children }: { children: ReactNode }) {
  const [categoryState, setCategoryState] = useState<CategoryState | null>(null)
  const [sidebarExtra, setSidebarExtra] = useState<ReactNode | null>(null)

  const register = useCallback((state: CategoryState) => {
    setCategoryState(state)
  }, [])

  const unregister = useCallback(() => {
    setCategoryState(null)
  }, [])

  const value = useMemo(
    () => ({ categoryState, register, unregister, sidebarExtra, setSidebarExtra }),
    [categoryState, register, unregister, sidebarExtra],
  )

  return (
    <CategoryDockContext.Provider value={value}>
      {children}
    </CategoryDockContext.Provider>
  )
}

/**
 * Hook for pages to register their video category state into the global dock.
 * Call from the videos page to add category items to the shared dock.
 */
export function useCategoryDock(currentCategory: CategoryType, onCategoryChange: (category: CategoryType) => void) {
  const { register, unregister } = useContext(CategoryDockContext)

  useEffect(() => {
    register({ currentCategory, onCategoryChange })
  }, [currentCategory, onCategoryChange, register])

  useEffect(() => {
    return () => unregister()
  }, [unregister])
}

export function useCategoryDockState() {
  return useContext(CategoryDockContext).categoryState
}

/**
 * Registers arbitrary page content (e.g. quick links, category filters) to be
 * rendered inside the persistent left sidebar, below the main nav items.
 * Call from a page component; content is unregistered automatically on unmount.
 */
export function useCategoryDockSidebarExtra(content: ReactNode | null) {
  const { setSidebarExtra } = useContext(CategoryDockContext)

  useEffect(() => {
    setSidebarExtra(content)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content])

  useEffect(() => {
    return () => setSidebarExtra(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

/** Reads the page-registered sidebar extra content. Used by the dock/sidebar itself. */
export function useCategoryDockSidebarExtraValue() {
  return useContext(CategoryDockContext).sidebarExtra
}
