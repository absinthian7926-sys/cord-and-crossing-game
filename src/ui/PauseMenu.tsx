import { useEffect, useRef, useState } from 'react'
import type { VolumeBus } from '../data/settings'
import type { QualityLevel } from '../data/zone'
import type { SettingsData } from '../game/settings/settings'
import { ControlsPanel } from './ControlsPanel'
import { SettingsPanel, type SettingsPanelSection } from './SettingsPanel'

type PausePanel = 'root' | 'controls' | SettingsPanelSection

export type PauseMenuProps = {
  readonly open: boolean
  readonly settings: SettingsData
  readonly onResume: () => void
  readonly onRestart: () => void
  readonly onCredits: () => void
  readonly onQualityChange: (quality: QualityLevel) => void
  readonly onVolumeChange: (bus: VolumeBus, value: number) => void
  readonly onReduceMotionChange: (value: boolean) => void
  readonly onMouseSensitivityChange: (value: number) => void
  readonly onInvertYChange: (value: boolean) => void
}

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute('hidden'))
}

export function PauseMenu({
  open,
  settings,
  onResume,
  onRestart,
  onCredits,
  onQualityChange,
  onVolumeChange,
  onReduceMotionChange,
  onMouseSensitivityChange,
  onInvertYChange,
}: PauseMenuProps) {
  const [panel, setPanel] = useState<PausePanel>('root')
  const [confirmRestart, setConfirmRestart] = useState(false)
  const dialog = useRef<HTMLElement>(null)
  const resume = useRef(onResume)
  resume.current = onResume

  useEffect(() => {
    if (!open) {
      setPanel('root')
      setConfirmRestart(false)
      return
    }
    const focusScope = confirmRestart
      ? dialog.current?.querySelector<HTMLElement>('.confirm-dialog')
      : dialog.current
    const focusables = focusScope ? focusableElements(focusScope) : []
    focusables[0]?.focus()

    const trapFocus = (event: KeyboardEvent) => {
      if (!dialog.current) return
      if (event.code === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()
        if (confirmRestart) setConfirmRestart(false)
        else if (panel !== 'root') setPanel('root')
        else resume.current()
        return
      }
      if (event.code !== 'Tab') return
      const activeScope = confirmRestart
        ? dialog.current.querySelector<HTMLElement>('.confirm-dialog')
        : dialog.current
      if (!activeScope) return
      const current = focusableElements(activeScope)
      if (current.length === 0) return
      event.preventDefault()
      const activeIndex = current.indexOf(document.activeElement as HTMLElement)
      const direction = event.shiftKey ? -1 : 1
      const nextIndex =
        (activeIndex + direction + current.length) % current.length
      current[nextIndex].focus()
    }
    document.addEventListener('keydown', trapFocus, true)
    return () => document.removeEventListener('keydown', trapFocus, true)
  }, [confirmRestart, open, panel])

  if (!open) return null

  return (
    <section
      ref={dialog}
      className="menu-screen pause-screen"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-title"
    >
      <div className="menu-panel pause-panel">
        {panel === 'root' ? (
          <>
            <h1 id="pause-title">Paused</h1>
            <div className="menu-actions">
              <button
                type="button"
                className="menu-button menu-button-primary"
                onClick={onResume}
              >
                Resume
              </button>
              <button
                type="button"
                className="menu-button"
                onClick={() => setPanel('controls')}
              >
                Controls
              </button>
              <button
                type="button"
                className="menu-button"
                onClick={() => setPanel('graphics')}
              >
                Graphics
              </button>
              <button
                type="button"
                className="menu-button"
                onClick={() => setPanel('volume')}
              >
                Volume
              </button>
              <button
                type="button"
                className="menu-button"
                onClick={() => setConfirmRestart(true)}
              >
                Restart
              </button>
              <button type="button" className="menu-button" onClick={onCredits}>
                Credits
              </button>
            </div>
          </>
        ) : panel === 'controls' ? (
          <ControlsPanel onBack={() => setPanel('root')} />
        ) : (
          <SettingsPanel
            section={panel}
            settings={settings}
            onQualityChange={onQualityChange}
            onVolumeChange={onVolumeChange}
            onReduceMotionChange={onReduceMotionChange}
            onMouseSensitivityChange={onMouseSensitivityChange}
            onInvertYChange={onInvertYChange}
            onBack={() => setPanel('root')}
          />
        )}
      </div>
      {confirmRestart && (
        <section
          className="confirm-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="pause-restart-question"
        >
          <div className="menu-panel confirm-panel">
            <h2 id="pause-restart-question">
              Restart the quest from the beginning? Your saved progress will be
              cleared.
            </h2>
            <div className="confirm-actions">
              <button
                type="button"
                className="menu-button menu-button-danger"
                onClick={onRestart}
              >
                Restart
              </button>
              <button
                type="button"
                className="menu-button"
                onClick={() => setConfirmRestart(false)}
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
