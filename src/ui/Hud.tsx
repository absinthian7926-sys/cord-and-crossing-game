import { useEffect, useRef } from 'react'
import { PLAYER } from '../data/player'
import { playerStore } from '../game/player/playerStore'

export function Hud() {
  const healthFill = useRef<HTMLDivElement>(null)
  const healthValue = useRef<HTMLSpanElement>(null)
  const staminaFill = useRef<HTMLDivElement>(null)
  const staminaValue = useRef<HTMLSpanElement>(null)
  const dodgeState = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const refresh = () => {
      const state = playerStore.getState()
      const healthPercent = Math.max(
        0,
        Math.min(100, (state.vitals.health / PLAYER.health.max) * 100),
      )
      const staminaPercent = Math.max(
        0,
        Math.min(100, (state.vitals.stamina / PLAYER.stamina.max) * 100),
      )
      if (healthFill.current)
        healthFill.current.style.width = `${healthPercent}%`
      if (healthValue.current)
        healthValue.current.textContent = `${Math.ceil(state.vitals.health)}`
      if (staminaFill.current)
        staminaFill.current.style.width = `${staminaPercent}%`
      if (staminaValue.current)
        staminaValue.current.textContent = `${Math.ceil(state.vitals.stamina)}`
      if (dodgeState.current)
        dodgeState.current.style.display = state.invulnerable ? 'block' : 'none'
    }
    refresh()
    const interval = window.setInterval(refresh, 100)
    return () => window.clearInterval(interval)
  }, [])

  return (
    <div className="hud" aria-label="Player status">
      <div className="controls-hint">
        WASD move · Shift run · Space jump · Ctrl or C dodge · Drag to look
      </div>
      <div className="vitals">
        <div className="hud-bar-wrap">
          <div className="hud-label">
            <span>Health</span>
            <span ref={healthValue}>{PLAYER.health.max}</span>
          </div>
          <div className="hud-bar">
            <div ref={healthFill} className="hud-bar-fill health-fill" />
          </div>
        </div>
        <div className="hud-bar-wrap">
          <div className="hud-label">
            <span>Stamina</span>
            <span ref={staminaValue}>{PLAYER.stamina.max}</span>
          </div>
          <div className="hud-bar">
            <div ref={staminaFill} className="hud-bar-fill stamina-fill" />
          </div>
        </div>
        <div ref={dodgeState} className="dodge-state">
          DODGE
        </div>
      </div>
      <div className="reticle" />
    </div>
  )
}
