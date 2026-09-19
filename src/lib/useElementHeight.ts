import { useEffect, useRef, useState } from 'react'

/**
 * Tracks an element's live rendered height via ResizeObserver. Used to lay out the card
 * with exact pixel arithmetic (see App.tsx) instead of relying on flexbox shrink/grow —
 * the two render engines Tauri uses (WebKit on macOS, WebView2/Chromium on Windows) don't
 * necessarily resolve flex-shrink + min-height:0 + overflow:hidden identically, which
 * showed up as the footer's padding getting clipped a few px in WebKit even though the
 * same layout measured correctly in Chromium during development.
 */
export function useElementHeight<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setHeight(el.getBoundingClientRect().height)
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    measure()
    return () => observer.disconnect()
  }, [])

  return [ref, height] as const
}
