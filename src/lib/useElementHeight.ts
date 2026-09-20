import { useCallback, useEffect, useState } from 'react'

/**
 * Tracks an element's live rendered height via ResizeObserver. Used to lay out the card
 * with exact pixel arithmetic (see App.tsx) instead of relying on flexbox shrink/grow —
 * the two render engines Tauri uses (WebKit on macOS, WebView2/Chromium on Windows) don't
 * necessarily resolve flex-shrink + min-height:0 + overflow:hidden identically, which
 * showed up as the footer's padding getting clipped a few px in WebKit even though the
 * same layout measured correctly in Chromium during development.
 *
 * Uses a callback ref so elements that mount later (e.g. only on one screen) are still
 * measured. The last measured height is kept while the element is unmounted.
 */
export function useElementHeight<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null)
  const [height, setHeight] = useState(0)
  const ref = useCallback((node: T | null) => setEl(node), [])

  useEffect(() => {
    if (!el) return
    const measure = () => setHeight(el.getBoundingClientRect().height)
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    measure()
    return () => observer.disconnect()
  }, [el])

  return [ref, height] as const
}
