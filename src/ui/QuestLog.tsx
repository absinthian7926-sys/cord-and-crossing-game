import { useEffect } from 'react'

export type QuestLogStep = {
  readonly id: string
  readonly order: number
  readonly text: string
  readonly completed: boolean
  readonly current: boolean
}

export type QuestLogProps = {
  readonly open: boolean
  readonly title: string
  readonly steps: readonly QuestLogStep[]
  readonly keyName: string
  readonly hasKey: boolean
  readonly keyUsed?: boolean
  readonly onClose: () => void
}

export function QuestLog({
  open,
  title,
  steps,
  keyName,
  hasKey,
  keyUsed = false,
  onClose,
}: QuestLogProps) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, open])

  if (!open) return null

  return (
    <section
      className="quest-log"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quest-log-title"
    >
      <header className="quest-log-header">
        <div>
          <h2 id="quest-log-title">{title}</h2>
        </div>
        <button
          type="button"
          className="quest-log-close"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onClose}
          aria-label="Close quest log"
        >
          Esc
        </button>
      </header>
      <ol className="quest-log-steps">
        {steps.map((step) => (
          <li
            key={step.id}
            className={[
              step.completed ? 'is-complete' : '',
              step.current ? 'is-current' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <span className="quest-step-marker" aria-hidden="true">
              {step.completed ? '✓' : step.order}
            </span>
            <span>{step.text}</span>
          </li>
        ))}
      </ol>
      <div className="quest-key-slot">
        <span>{keyName}</span>
        <strong aria-label={hasKey ? 'Key held' : 'Key not held'}>
          {hasKey ? (keyUsed ? 'Used' : '✓') : '○'}
        </strong>
      </div>
    </section>
  )
}
