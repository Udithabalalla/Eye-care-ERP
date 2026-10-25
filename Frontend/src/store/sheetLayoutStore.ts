import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Docked against the page layout (content reflows) vs. detached overlay. */
export type SheetMode = 'pinned' | 'floating'

export const MIN_SHEET_WIDTH = 320
export const MAX_SHEET_WIDTH = 900
export const DEFAULT_SHEET_WIDTH = 384

export const clampSheetWidth = (width: number) =>
  Math.min(
    Math.max(width, MIN_SHEET_WIDTH),
    Math.min(MAX_SHEET_WIDTH, Math.round(window.innerWidth * 0.8)),
  )

interface SheetLayoutState {
  /** User preference, persisted across sessions. */
  mode: SheetMode
  width: number
  /** Live footprint of each open pinned sheet, keyed by instance id. */
  reserved: Record<string, number>
  setMode: (mode: SheetMode) => void
  toggleMode: () => void
  setWidth: (width: number) => void
  reserve: (id: string, width: number) => void
  release: (id: string) => void
}

export const useSheetLayoutStore = create<SheetLayoutState>()(
  persist(
    (set) => ({
      mode: 'pinned',
      width: DEFAULT_SHEET_WIDTH,
      reserved: {},

      setMode: (mode) => set({ mode }),

      toggleMode: () =>
        set((state) => ({
          mode: state.mode === 'pinned' ? 'floating' : 'pinned',
        })),

      setWidth: (width) => set({ width }),

      reserve: (id, width) =>
        set((state) =>
          state.reserved[id] === width
            ? state
            : { reserved: { ...state.reserved, [id]: width } },
        ),

      release: (id) =>
        set((state) => {
          if (!(id in state.reserved)) return state
          const reserved = { ...state.reserved }
          delete reserved[id]
          return { reserved }
        }),
    }),
    {
      name: 'sheet-layout',
      // Only the user's preference persists — live reservations are per-session.
      partialize: (state) => ({ mode: state.mode, width: state.width }),
    },
  ),
)

/** Horizontal space the page must yield to any open pinned sheet. */
export const useReservedSheetWidth = () =>
  useSheetLayoutStore((state) => {
    const values = Object.values(state.reserved)
    return values.length ? Math.max(...values) : 0
  })
