import { useEffect } from 'react'
import { QUEST_UI } from '../data/quests'

export type DialogueChoice = {
  readonly id: string
  readonly label: string
}

export type DialogueProps = {
  readonly open: boolean
  readonly speaker: string
  readonly line: string
  readonly choices: readonly DialogueChoice[]
  readonly onChoose: (choiceId: string) => void
  readonly onClose: () => void
}

export function Dialogue({
  open,
  speaker,
  line,
  choices,
  onChoose,
  onClose,
}: DialogueProps) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      const choiceIndex = Number(event.key) - 1
      if (
        Number.isInteger(choiceIndex) &&
        choiceIndex >= 0 &&
        choiceIndex < choices.length
      ) {
        event.preventDefault()
        onChoose(choices[choiceIndex].id)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [choices, onChoose, onClose, open])

  if (!open) return null

  return (
    <section
      className="dialogue-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialogue-speaker"
      style={{
        maxWidth: QUEST_UI.dialogue.maxWidthPixels,
        backgroundColor: QUEST_UI.dialogue.parchmentColor,
        color: QUEST_UI.dialogue.inkColor,
      }}
    >
      <h2 id="dialogue-speaker" className="dialogue-speaker">
        {speaker}
      </h2>
      <p className="dialogue-line">{line}</p>
      <ol className="dialogue-choices">
        {choices.map((choice, index) => (
          <li key={choice.id}>
            <button
              type="button"
              className="dialogue-choice"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => onChoose(choice.id)}
            >
              <span aria-hidden="true">{index + 1}.</span> {choice.label}
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}
