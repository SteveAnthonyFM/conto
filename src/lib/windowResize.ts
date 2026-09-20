import { LogicalSize } from '@tauri-apps/api/dpi'
import { getCurrentWindow } from '@tauri-apps/api/window'

/** Tauri's setSize is instant — this drives it across several frames with an ease-out
 * curve so growing/shrinking the window for the History panel reads as a fluid resize
 * rather than a snap. */
export function animateWindowResize(widthPx: number, fromHeightPx: number, toHeightPx: number, durationMs = 220): Promise<void> {
  const win = getCurrentWindow()
  return new Promise((resolve) => {
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1)
      const eased = 1 - (1 - t) ** 3
      const height = fromHeightPx + (toHeightPx - fromHeightPx) * eased
      void win.setSize(new LogicalSize(widthPx, height))
      if (t < 1) requestAnimationFrame(step)
      else resolve()
    }
    requestAnimationFrame(step)
  })
}

/**
 * Same easing as animateWindowResize, but also drives the History panel's own height
 * from `fromPanelPx` to `toPanelPx` on the *same* frames as the window resize
 * (`onPanelHeight` is called with the interpolated value each frame).
 *
 * This is what the plain animateWindowResize doesn't give you: if the panel's height
 * jumps to its target instantly while the window is still mid-resize, the Weekly gauge's
 * available space (window height minus every other fixed region, panel included)
 * momentarily goes negative and it visibly fades out and back in — a flicker — before
 * the window catches up. Growing both numbers in lockstep keeps Weekly's leftover space
 * constant throughout, so it never has a reason to move.
 */
export function animateWindowResizeWithPanel(
  widthPx: number,
  fromHeightPx: number,
  toHeightPx: number,
  fromPanelPx: number,
  toPanelPx: number,
  onPanelHeight: (px: number) => void,
  durationMs = 220,
): Promise<void> {
  const win = getCurrentWindow()
  return new Promise((resolve) => {
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1)
      const eased = 1 - (1 - t) ** 3
      const height = fromHeightPx + (toHeightPx - fromHeightPx) * eased
      const panel = fromPanelPx + (toPanelPx - fromPanelPx) * eased
      void win.setSize(new LogicalSize(widthPx, height))
      onPanelHeight(panel)
      if (t < 1) requestAnimationFrame(step)
      else {
        onPanelHeight(toPanelPx)
        resolve()
      }
    }
    requestAnimationFrame(step)
  })
}

/** Current window size in logical (CSS) pixels, accounting for display scale factor. */
export async function getLogicalWindowSize(): Promise<{ width: number; height: number }> {
  const win = getCurrentWindow()
  const [inner, scale] = await Promise.all([win.innerSize(), win.scaleFactor()])
  return { width: inner.width / scale, height: inner.height / scale }
}

/** Sets the window's height instantly, keeping its current width. */
export async function setWindowHeight(heightPx: number): Promise<void> {
  const { width } = await getLogicalWindowSize()
  await getCurrentWindow().setSize(new LogicalSize(width, heightPx))
}
