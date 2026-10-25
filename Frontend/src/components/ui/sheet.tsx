import * as React from "react"
import { Dialog as SheetPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { RiCloseLine, RiPushpin2Line, RiUnpinLine } from "@remixicon/react"
import {
  clampSheetWidth,
  useSheetLayoutStore,
} from "@/store/sheetLayoutStore"

type SheetSide = "top" | "right" | "bottom" | "left"
type SheetVariant = "inset" | "flush"

/**
 * Positioning is resolved in JS from the `side`/`variant` props rather than via
 * `data-[side=...]` variants so that plain utilities passed by consumers (e.g.
 * `sm:max-w-lg`) win through tailwind-merge. Attribute-selector variants carry
 * extra specificity and would silently override the caller's width.
 *
 * `--sheet-header-offset` keeps the panel below the app header so it reads as
 * part of the page rather than an overlay floating above the whole shell.
 */
const PINNED_CLASSES: Record<SheetSide, string> = {
  right: "top-[var(--sheet-header-offset,0px)] bottom-0 right-0 border-l",
  left: "top-[var(--sheet-header-offset,0px)] bottom-0 left-0 border-r",
  top: "inset-x-0 top-0 h-auto border-b",
  bottom: "inset-x-0 bottom-0 h-auto border-t",
}

const FLOATING_CLASSES: Record<SheetSide, string> = {
  right:
    "top-[calc(var(--sheet-header-offset,0px)+0.75rem)] bottom-3 right-3 rounded-xl border shadow-2xl",
  left: "top-[calc(var(--sheet-header-offset,0px)+0.75rem)] bottom-3 left-3 rounded-xl border shadow-2xl",
  top: "inset-x-3 top-3 h-auto rounded-xl border shadow-2xl",
  bottom: "inset-x-3 bottom-3 h-auto rounded-xl border shadow-2xl",
}

const FLUSH_CLASSES: Record<SheetSide, string> = {
  right: "inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm",
  left: "inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm",
  top: "inset-x-0 top-0 h-auto border-b",
  bottom: "inset-x-0 bottom-0 h-auto border-t",
}

// Overlays that open on top of a sheet, and table rows that switch what it shows;
// interacting with them must not dismiss it
const LAYERED_UI_SELECTOR =
  '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [data-radix-popper-content-wrapper], [data-keeps-drawer-open]'

const SIDE_ANIMATIONS: Record<SheetSide, string> = {
  right: "data-open:slide-in-from-right-10 data-closed:slide-out-to-right-10",
  left: "data-open:slide-in-from-left-10 data-closed:slide-out-to-left-10",
  top: "data-open:slide-in-from-top-10 data-closed:slide-out-to-top-10",
  bottom: "data-open:slide-in-from-bottom-10 data-closed:slide-out-to-bottom-10",
}

function Sheet({
  modal = false,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" modal={modal} {...props} />
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetContent({
  className,
  children,
  side = "right",
  variant = "inset",
  showCloseButton = true,
  onInteractOutside,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: SheetSide
  variant?: SheetVariant
  showCloseButton?: boolean
}) {
  const layoutId = React.useId()
  // Radix only mounts the portal content once the sheet is open, so a plain
  // ref would still be null when effects first run. Tracking the node in state
  // makes its mount a dependency, so measurement happens on every open.
  const [panelNode, setPanelNode] = React.useState<HTMLDivElement | null>(null)
  const [isResizing, setIsResizing] = React.useState(false)

  const mode = useSheetLayoutStore((s) => s.mode)
  const width = useSheetLayoutStore((s) => s.width)

  // `flush` panels (e.g. the mobile sidebar) keep their own sizing and always
  // overlay. Only edge panels participate in pin/resize.
  const isEdgePanel =
    variant === "inset" && (side === "left" || side === "right")
  const isPinned = mode === "pinned"
  // A pinned right-hand panel is the only case that reflows the page.
  const reservesSpace = isEdgePanel && side === "right" && isPinned

  React.useEffect(() => {
    const node = panelNode
    if (!reservesSpace || !node) return

    const { reserve, release } = useSheetLayoutStore.getState()

    const measure = () => {
      // `offsetWidth` and the computed `right` are layout values, so they are
      // unaffected by the slide-in transform. `getBoundingClientRect()` would
      // include it and under-report the panel's resting footprint.
      const gap = parseFloat(getComputedStyle(node).right) || 0
      const footprint = node.offsetWidth + gap
      // On narrow screens the panel covers most of the viewport; reflowing
      // would crush the page, so fall back to overlay behaviour.
      reserve(layoutId, footprint > window.innerWidth * 0.6 ? 0 : footprint)
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    window.addEventListener("resize", measure)

    return () => {
      observer.disconnect()
      window.removeEventListener("resize", measure)
      release(layoutId)
    }
  }, [layoutId, reservesSpace, panelNode])

  const startResize = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const node = panelNode
      if (!node) return
      event.preventDefault()

      const startX = event.clientX
      const startWidth = node.offsetWidth
      const { setWidth } = useSheetLayoutStore.getState()
      setIsResizing(true)

      const onMove = (moveEvent: PointerEvent) => {
        // Dragging the inner edge outward (towards the page) widens the panel.
        const delta =
          side === "right"
            ? startX - moveEvent.clientX
            : moveEvent.clientX - startX
        setWidth(clampSheetWidth(startWidth + delta))
      }

      const onUp = () => {
        setIsResizing(false)
        document.removeEventListener("pointermove", onMove)
        document.body.style.removeProperty("user-select")
      }

      document.addEventListener("pointermove", onMove)
      document.addEventListener("pointerup", onUp, { once: true })
      document.body.style.userSelect = "none"
    },
    [side, panelNode]
  )

  const positionClasses = !isEdgePanel
    ? FLUSH_CLASSES[side]
    : isPinned
      ? PINNED_CLASSES[side]
      : FLOATING_CLASSES[side]

  return (
    <SheetPortal>
      <SheetPrimitive.Content
        ref={setPanelNode}
        data-slot="sheet-content"
        data-side={side}
        data-variant={variant}
        data-mode={isEdgePanel ? mode : undefined}
        data-resizing={isResizing ? "" : undefined}
        style={
          isEdgePanel ? { width, maxWidth: "calc(100vw - 1.5rem)" } : undefined
        }
        className={cn(
          "fixed z-50 flex flex-col overflow-hidden bg-popover bg-clip-padding text-xs/relaxed text-popover-foreground outline-none transition duration-200 ease-in-out",
          "data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
          // Pinned panels sit flush in the layout, so they carry a divider
          // rather than a lifted shadow.
          isEdgePanel && isPinned ? "shadow-none" : "shadow-2xl",
          // Dragging must track the pointer exactly, with no easing lag.
          isResizing && "transition-none animate-none select-none",
          positionClasses,
          SIDE_ANIMATIONS[side],
          className
        )}
        onInteractOutside={(event) => {
          // Sheets are non-modal, so Radix closes them when focus or a click
          // lands outside. A dialog, menu or popover opened from the sheet
          // (e.g. Record Payment) is layered above it, not outside it — closing
          // here would also unmount whatever the sheet just opened.
          const target = event.target as Element | null
          if (target?.closest?.(LAYERED_UI_SELECTOR)) event.preventDefault()
          onInteractOutside?.(event)
        }}
        {...props}
      >
        {isEdgePanel && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize panel"
            onPointerDown={startResize}
            onDoubleClick={() =>
              useSheetLayoutStore.getState().setWidth(clampSheetWidth(384))
            }
            className={cn(
              "group absolute inset-y-0 z-20 hidden w-1.5 cursor-col-resize touch-none sm:block",
              side === "right" ? "left-0" : "right-0"
            )}
          >
            <div className="h-full w-full bg-transparent transition-colors group-hover:bg-primary/40 group-active:bg-primary/60" />
          </div>
        )}

        {children}

        <div className="absolute top-4 right-4 z-20 flex items-center gap-1">
          {isEdgePanel && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-pressed={isPinned}
              title={isPinned ? "Detach panel" : "Pin panel to page"}
              onClick={() => useSheetLayoutStore.getState().toggleMode()}
            >
              {isPinned ? <RiPushpin2Line /> : <RiUnpinLine />}
              <span className="sr-only">
                {isPinned ? "Detach panel" : "Pin panel to page"}
              </span>
            </Button>
          )}
          {showCloseButton && (
            <SheetPrimitive.Close data-slot="sheet-close" asChild>
              <Button variant="ghost" size="icon-sm">
                <RiCloseLine />
                <span className="sr-only">Close</span>
              </Button>
            </SheetPrimitive.Close>
          )}
        </div>
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex shrink-0 flex-col gap-1.5 p-6", className)}
      {...props}
    />
  )
}

/**
 * Scrollable region between a sticky header and footer. Owns `min-h-0` so it
 * shrinks inside the flex column instead of overflowing and clipping content.
 */
function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-body"
      className={cn(
        "custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain",
        className
      )}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex shrink-0 flex-col gap-2 p-6", className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        "font-heading text-sm font-medium text-foreground",
        className
      )}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-xs/relaxed text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
