import { useState } from 'react'

export type TitleScreenProps = {
  readonly open: boolean
  readonly hasValidSave: boolean
  readonly onContinue: () => void
  readonly onNewGame: () => void
  readonly onCredits: () => void
  readonly onUserGesture: () => void
}

export function TitleScreen({
  open,
  hasValidSave,
  onContinue,
  onNewGame,
  onCredits,
  onUserGesture,
}: TitleScreenProps) {
  const [confirmRestart, setConfirmRestart] = useState(false)
  if (!open) return null

  const gesture = (action: () => void) => {
    onUserGesture()
    action()
  }

  return (
    <section className="menu-screen title-screen" aria-labelledby="game-title">
      <div className="menu-panel title-panel">
        <h1 id="game-title">Cord and Crossing</h1>
        <div className="menu-actions">
          {hasValidSave && (
            <button
              type="button"
              className="menu-button menu-button-primary"
              onClick={() => gesture(onContinue)}
            >
              Continue
            </button>
          )}
          <button
            type="button"
            className={
              hasValidSave ? 'menu-button' : 'menu-button menu-button-primary'
            }
            onClick={() =>
              gesture(() => {
                if (hasValidSave) setConfirmRestart(true)
                else onNewGame()
              })
            }
          >
            New game
          </button>
          <button
            type="button"
            className="menu-button"
            onClick={() => gesture(onCredits)}
          >
            Credits
          </button>
        </div>
      </div>
      {confirmRestart && (
        <section
          className="confirm-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="title-restart-question"
        >
          <div className="menu-panel confirm-panel">
            <h2 id="title-restart-question">
              Restart the quest from the beginning? Your saved progress will be
              cleared.
            </h2>
            <div className="confirm-actions">
              <button
                type="button"
                className="menu-button menu-button-danger"
                onClick={() => gesture(onNewGame)}
              >
                Restart
              </button>
              <button
                type="button"
                className="menu-button"
                onClick={() => gesture(() => setConfirmRestart(false))}
              >
                Cancel
              </button>
            </div>
          </div>
        </section>
      )}
    </section>
  )
}
