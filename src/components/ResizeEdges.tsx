import { useRef, type MutableRefObject, type PointerEvent as ReactPointerEvent } from 'react'
import { LogicalPosition, LogicalSize } from '@tauri-apps/api/dpi'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { MAX_WINDOW_WIDTH, MIN_WINDOW_WIDTH } from '../lib/windowResize'

type Edge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

// The native resize border of a frameless window is only a few pixels wide and sits in the
// card's transparent margin, so it's very hard to hit. These zones are much more generous:
// they overlap the margin AND the card's outer edge, and drive the resize ourselves.
const EDGE = 10
const CORNER = 16

const ZONES: { edge: Edge; cursor: string; style: React.CSSProperties }[] = [
  { edge: 'w', cursor: 'ew-resize', style: { left: 0, top: CORNER, bottom: CORNER, width: EDGE } },
  { edge: 'e', cursor: 'ew-resize', style: { right: 0, top: CORNER, bottom: CORNER, width: EDGE } },
  { edge: 'n', cursor: 'ns-resize', style: { top: 0, left: CORNER, right: CORNER, height: EDGE } },
  { edge: 's', cursor: 'ns-resize', style: { bottom: 0, left: CORNER, right: CORNER, height: EDGE } },
  { edge: 'nw', cursor: 'nwse-resize', style: { top: 0, left: 0, width: CORNER, height: CORNER } },
  { edge: 'ne', cursor: 'nesw-resize', style: { top: 0, right: 0, width: CORNER, height: CORNER } },
  { edge: 'sw', cursor: 'nesw-resize', style: { bottom: 0, left: 0, width: CORNER, height: CORNER } },
  { edge: 'se', cursor: 'nwse-resize', style: { bottom: 0, right: 0, width: CORNER, height: CORNER } },
]

interface Drag {
  edge: Edge
  sx: number
  sy: number
  w: number
  h: number
  x: number
  y: number
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

interface ResizeEdgesProps {
  /** Live height limits for the current screen (kept in a ref so drags always see the latest). */
  limits: MutableRefObject<{ minH: number; maxH: number }>
  /** False when the current screen has a single fixed height — vertical zones are hidden. */
  canResizeVertically: boolean
}

export function ResizeEdges({ limits, canResizeVertically }: ResizeEdgesProps) {
  const drag = useRef<Drag | null>(null)
  const frame = useRef<number | null>(null)

  const onDown = async (edge: Edge, e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const win = getCurrentWindow()
    const [inner, pos, scale] = await Promise.all([win.innerSize(), win.outerPosition(), win.scaleFactor()])
    drag.current = { edge, sx: e.screenX, sy: e.screenY, w: inner.width / scale, h: inner.height / scale, x: pos.x / scale, y: pos.y / scale }
  }

  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    const dx = e.screenX - d.sx
    const dy = e.screenY - d.sy
    const { minH, maxH } = limits.current
    let { w, h, x, y } = d
    if (d.edge.includes('e')) w = clamp(d.w + dx, MIN_WINDOW_WIDTH, MAX_WINDOW_WIDTH)
    if (d.edge.includes('w')) {
      w = clamp(d.w - dx, MIN_WINDOW_WIDTH, MAX_WINDOW_WIDTH)
      x = d.x + (d.w - w)
    }
    if (d.edge.includes('s')) h = clamp(d.h + dy, minH, maxH)
    if (d.edge.includes('n')) {
      h = clamp(d.h - dy, minH, maxH)
      y = d.y + (d.h - h)
    }
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      const win = getCurrentWindow()
      void win.setSize(new LogicalSize(w, h))
      if (x !== d.x || y !== d.y) void win.setPosition(new LogicalPosition(x, y))
    })
  }

  const onUp = () => {
    drag.current = null
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-50">
      {ZONES.filter((z) => canResizeVertically || z.edge === 'e' || z.edge === 'w').map((z) => (
        <div
          key={z.edge}
          className="pointer-events-auto absolute"
          style={{ ...z.style, cursor: z.cursor }}
          onPointerDown={(e) => void onDown(z.edge, e)}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />
      ))}
    </div>
  )
}
