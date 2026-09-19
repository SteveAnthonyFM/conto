import { useEffect, useRef, useState } from 'react'

/** Like useElementHeight, but width+height — used by UsageChart so its SVG viewBox can
 * match the container's real pixel size exactly (see the note at the top of
 * UsageChart.tsx for why that matters for undistorted text). */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight })
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    measure()
    return () => observer.disconnect()
  }, [])

  return [ref, size] as const
}
