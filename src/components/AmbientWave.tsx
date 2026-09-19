// Faint line-art wave behind the title, adapted from Studiolo's AmbientBackground.
// Crisp strokes only, no blur, and it fades to transparent toward the bottom.
export function AmbientWave() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 h-28 text-[var(--color-accent)]"
      style={{
        WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 40%, transparent 100%)',
        maskImage: 'linear-gradient(to bottom, black 0%, black 40%, transparent 100%)',
      }}
    >
      <svg width="100%" height="100%" viewBox="0 0 400 120" preserveAspectRatio="none" style={{ opacity: 0.29 }}>
        <defs>
          <linearGradient id="wave-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.04" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.85" />
          </linearGradient>
          <radialGradient id="wave-glow" cx="80%" cy="0%" r="70%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.45" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="400" height="120" fill="url(#wave-glow)" />
        <path d="M -20 40 C 70 5, 150 85, 240 48 C 300 24, 340 36, 400 10" stroke="url(#wave-grad)" strokeWidth="2.5" fill="none" />
        <path d="M -20 60 C 80 24, 165 100, 260 64 C 320 40, 360 52, 420 28" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.5" />
        <path d="M -20 80 C 95 42, 175 118, 280 82 C 335 60, 375 70, 430 46" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.32" />
      </svg>
    </div>
  )
}
