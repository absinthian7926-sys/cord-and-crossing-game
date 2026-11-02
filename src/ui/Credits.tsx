import { CREDITS_LINES } from '../data/credits'

export type CreditsProps = {
  readonly open: boolean
  readonly onClose: () => void
}

export function Credits({ open, onClose }: CreditsProps) {
  if (!open) return null
  return (
    <section
      className="menu-screen credits-screen"
      role="dialog"
      aria-modal="true"
      aria-labelledby="credits-title"
    >
      <div className="menu-panel credits-panel">
        <h1 id="credits-title">{CREDITS_LINES[0]}</h1>
        <div className="credits-copy">
          {CREDITS_LINES.slice(1).map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <button type="button" className="menu-button" onClick={onClose}>
          Back
        </button>
      </div>
    </section>
  )
}
