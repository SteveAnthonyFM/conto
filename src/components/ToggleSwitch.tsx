interface ToggleSwitchProps {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
}

export function ToggleSwitch({ checked, onChange, label }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      onClick={() => onChange(!checked)}
      className="relative h-[18px] w-[32px] shrink-0 rounded-full border transition-colors duration-200"
      style={{
        backgroundColor: checked ? 'var(--color-accent)' : 'var(--color-chip-bg)',
        borderColor: checked ? 'var(--color-accent)' : 'var(--color-border)',
      }}
    >
      <span
        className="absolute top-[2px] h-[14px] w-[14px] rounded-full bg-[var(--color-text)] transition-[left] duration-200"
        style={{ left: checked ? '16px' : '2px' }}
      />
    </button>
  )
}
