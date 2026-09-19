import { useEffect, useRef, useState, type ReactNode } from 'react'

interface CollapsibleSlotProps {
  className?: string
  /** Exact height in px for this slot, computed by the caller (see App.tsx). Not a
   * flex-grow/shrink value — see the note on why below. */
  heightPx: number
  children: ReactNode
}

/**
 * A slot that fades its content out (rather than letting it clip mid-line) once the
 * height it's been given drops below what the content actually needs. Used for the
 * Weekly gauge, which is the part of the card that gives way as the window is resized
 * shorter — the header, Session gauge and footer all keep their natural size.
 *
 * `heightPx` is computed by the caller from real measured element heights, not derived
 * from flex-shrink: the two engines Tauri renders through (WebKit on macOS, Chromium/
 * WebView2 on Windows) don't reliably agree on how a flex-shrink + min-height:0 +
 * overflow-hidden child resolves at the same window size, which showed up as the
 * footer's own padding getting clipped by a few px in WebKit. Exact pixel arithmetic
 * sidesteps that entirely.
 */
export function CollapsibleSlot({ className, heightPx, children }: CollapsibleSlotProps) {
  const innerRef = useRef<HTMLDivElement>(null)
  const [fits, setFits] = useState(true)

  useEffect(() => {
    const inner = innerRef.current
    if (!inner) return
    const check = () => setFits(heightPx >= inner.scrollHeight)
    const observer = new ResizeObserver(check)
    observer.observe(inner)
    check()
    return () => observer.disconnect()
  }, [heightPx, children])

  return (
    <div className={className} style={{ height: `${Math.max(heightPx, 0)}px` }}>
      <div ref={innerRef} style={{ opacity: fits ? 1 : 0, transition: 'opacity 120ms ease-out' }}>
        {children}
      </div>
    </div>
  )
}
