import { useEffect, useRef } from 'react'
import { PLAYER_DEATH } from '../data/enemies'
import { FEEL } from '../data/feel'
import { PLAYER } from '../data/player'
import { QUEST_UI } from '../data/quests'
import { ZONE } from '../data/zone'
import { effectRuntime, hasStrength } from '../game/effects/effectRuntime'
import { playerStore } from '../game/player/playerStore'
import { getQuestRuntimeSnapshot } from '../game/quest/questRuntime'
import {
  getPorticoRuntimeSnapshot,
  isKeyUseNearby,
  shouldShowHeelstonePrompt,
  shouldShowUseKeyPrompt,
} from '../game/portico/porticoRuntime'
import { weaponRuntime } from '../game/weapons/weaponRuntime'
import { getSettingsRuntimeSnapshot } from '../game/settings/settingsRuntime'

export type QuestTrackerHud = {
  readonly text: string
  readonly revision: number
}

export type HudProps = {
  readonly questTracker?: QuestTrackerHud | null
}

export function Hud({ questTracker = null }: HudProps) {
  const questRevision = questTracker?.revision ?? -1
  const healthFill = useRef<HTMLDivElement>(null)
  const healthValue = useRef<HTMLSpanElement>(null)
  const staminaFill = useRef<HTMLDivElement>(null)
  const staminaValue = useRef<HTMLSpanElement>(null)
  const dodgeState = useRef<HTMLDivElement>(null)
  const cordState = useRef<HTMLDivElement>(null)
  const deathFade = useRef<HTMLDivElement>(null)
  const questTrackerElement = useRef<HTMLDivElement>(null)
  const effectSlotOne = useRef<HTMLDivElement>(null)
  const effectSlotTwo = useRef<HTMLDivElement>(null)
  const useKeyPrompt = useRef<HTMLDivElement>(null)
  const clearLinePrompt = useRef<HTMLDivElement>(null)
  const lastDisplayed = useRef({
    health: -1,
    stamina: -1,
    invulnerable: false,
    cord: '',
    retie: -1,
    deathOpacity: -1,
    effectOne: '',
    effectTwo: '',
    showUseKey: false,
    showClearLine: false,
  })

  useEffect(() => {
    const refresh = () => {
      const state = playerStore.getState()
      const health = Math.ceil(state.vitals.health)
      const stamina = Math.ceil(state.vitals.stamina)
      const healthPercent = Math.max(
        0,
        Math.min(100, (state.vitals.health / PLAYER.health.max) * 100),
      )
      const staminaPercent = Math.max(
        0,
        Math.min(100, (state.vitals.stamina / PLAYER.stamina.max) * 100),
      )
      if (health !== lastDisplayed.current.health) {
        if (healthFill.current)
          healthFill.current.style.width = `${healthPercent}%`
        if (healthValue.current) healthValue.current.textContent = `${health}`
        lastDisplayed.current.health = health
      }
      if (stamina !== lastDisplayed.current.stamina) {
        if (staminaFill.current)
          staminaFill.current.style.width = `${staminaPercent}%`
        if (staminaValue.current)
          staminaValue.current.textContent = `${stamina}`
        lastDisplayed.current.stamina = stamina
      }
      if (state.invulnerable !== lastDisplayed.current.invulnerable) {
        if (dodgeState.current)
          dodgeState.current.style.display = state.invulnerable
            ? 'block'
            : 'none'
        lastDisplayed.current.invulnerable = state.invulnerable
      }
      const cord = weaponRuntime.cord
      const retie = Math.max(0, Math.ceil(cord.retieRemaining * 10) / 10)
      if (
        cord.mode !== lastDisplayed.current.cord ||
        retie !== lastDisplayed.current.retie
      ) {
        if (cordState.current) {
          const label = cord.mode === 'InHand' ? 'In Hand' : cord.mode
          cordState.current.textContent =
            cord.mode === 'Cut'
              ? `${label} · re-tie ${retie.toFixed(1)}s`
              : label
        }
        lastDisplayed.current.cord = cord.mode
        lastDisplayed.current.retie = retie
      }
      const deathFadeSeconds = getSettingsRuntimeSnapshot().reduceMotion
        ? FEEL.reduceMotion.transitionFadeSeconds
        : PLAYER_DEATH.fadeSeconds
      const deathOpacity =
        state.death.phase === 'Fading'
          ? Math.max(
              0,
              Math.min(
                1,
                (PLAYER_DEATH.fadeSeconds - state.death.fadeRemainingSeconds) /
                  deathFadeSeconds,
              ),
            )
          : 0
      if (deathOpacity !== lastDisplayed.current.deathOpacity) {
        if (deathFade.current)
          deathFade.current.style.opacity = deathOpacity.toFixed(3)
        lastDisplayed.current.deathOpacity = deathOpacity
      }
      const effectLabels = ['', '']
      let effectIndex = 0
      for (const slot of effectRuntime.effects.slots) {
        if (slot.definition === null || effectIndex >= effectLabels.length)
          continue
        effectLabels[effectIndex] =
          `${slot.definition.id} ${Math.ceil(slot.remainingSeconds)}s`
        effectIndex += 1
      }
      if (effectLabels[0] !== lastDisplayed.current.effectOne) {
        if (effectSlotOne.current) {
          effectSlotOne.current.textContent = effectLabels[0]
          effectSlotOne.current.style.display = effectLabels[0]
            ? 'block'
            : 'none'
        }
        lastDisplayed.current.effectOne = effectLabels[0]
      }
      if (effectLabels[1] !== lastDisplayed.current.effectTwo) {
        if (effectSlotTwo.current) {
          effectSlotTwo.current.textContent = effectLabels[1]
          effectSlotTwo.current.style.display = effectLabels[1]
            ? 'block'
            : 'none'
        }
        lastDisplayed.current.effectTwo = effectLabels[1]
      }
      const quest = getQuestRuntimeSnapshot().quest
      const portico = getPorticoRuntimeSnapshot()
      const showUseKey = shouldShowUseKeyPrompt({
        nearby: isKeyUseNearby(),
        questStep: quest.currentStep,
        keyLooted: quest.keyLooted,
        phase: portico.phase,
      })
      if (showUseKey !== lastDisplayed.current.showUseKey) {
        if (useKeyPrompt.current)
          useKeyPrompt.current.style.display = showUseKey ? 'block' : 'none'
        lastDisplayed.current.showUseKey = showUseKey
      }
      const showClearLine = shouldShowHeelstonePrompt({
        hasActiveEffect: hasStrength(),
        cordInHand: weaponRuntime.cord.mode === 'InHand',
        passIdle: effectRuntime.pass.mode === 'Idle',
        lineCarrying: effectRuntime.effects.carriedEffectId !== null,
      })
      if (showClearLine !== lastDisplayed.current.showClearLine) {
        if (clearLinePrompt.current)
          clearLinePrompt.current.style.display = showClearLine
            ? 'block'
            : 'none'
        lastDisplayed.current.showClearLine = showClearLine
      }
    }
    refresh()
    const interval = window.setInterval(refresh, 100)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    const element = questTrackerElement.current
    if (!element || questRevision < 0) return
    element.classList.add('is-highlighted')
    const timeout = window.setTimeout(
      () => element.classList.remove('is-highlighted'),
      QUEST_UI.tracker.highlightSeconds * 1000,
    )
    return () => window.clearTimeout(timeout)
  }, [questRevision])

  return (
    <div className="hud" aria-label="Player status">
      <div className="controls-hint">
        Click to look · LMB strike · RMB aim/cast · Q recall/stop
      </div>
      <div className="vitals">
        <div className="effect-slots" aria-label="Active effects">
          <div ref={effectSlotOne} className="effect-slot" />
          <div ref={effectSlotTwo} className="effect-slot" />
        </div>
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
      <div ref={cordState} className="cord-state">
        In Hand
      </div>
      <div ref={useKeyPrompt} className="action-prompt use-key-prompt">
        {ZONE.portico.useKeyPrompt}
      </div>
      <div ref={clearLinePrompt} className="action-prompt clear-line-prompt">
        {ZONE.portico.clearLinePrompt}
      </div>
      {questTracker && (
        <div
          ref={questTrackerElement}
          className="quest-tracker"
          aria-live="polite"
          style={{ fontSize: QUEST_UI.tracker.fontSizePixels }}
        >
          {questTracker.text}
        </div>
      )}
      <div ref={deathFade} className="death-fade" aria-hidden="true" />
    </div>
  )
}
