import { AmbientWave } from './components/AmbientWave'

export function App() {
  return (
    <div className="h-full p-1.5">
      <main className="relative h-full overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <AmbientWave />
        <header
          data-tauri-drag-region
          className="relative z-10 flex items-center justify-between px-4 pt-3.5"
        >
          <h1 className="font-display text-[15px] font-bold tracking-[0.18em]">CONTO</h1>
        </header>
        <p className="relative z-10 px-4 pt-10 text-sm text-[var(--color-text-muted)]">
          Scaffold ready. Gauges arrive in Milestone 3.
        </p>
      </main>
    </div>
  )
}
