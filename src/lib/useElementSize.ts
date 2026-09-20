import { useCallback, useEffect, useState } from 'react'

/** Like useElementHeight, but width+height — used by UsageChart so its SVG viewBox can
 * match the container's real pixel size exactly (see the note at the top of
 * UsageChart.tsx for why that matters for undistorted text).
 *
 * Uses a callback ref (state-held element) rather than useRef+useEffect([]): the target
 * may mount after the hook's owner does (UsageChart only renders the measured div once
 * it has data), and an effect with empty deps would have already run against a null ref. */
export function useElementSize<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const ref = useCallback((node: T | null) => setEl(node), [])

  useEffect(() => {
    if (!el) return
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight })
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    measure()
    return () => observer.disconnect()
  }, [el])

  return [ref, size] as const
}
