import { useEffect, useRef } from 'react'
import { FEEL } from '../data/feel'
import {
  stepPlayerHitVignette,
  subscribePlayerHitVignette,
} from '../game/feel/feelRuntime'
import { subscribePausableClock } from '../game/pause/pauseRuntime'
import { getSettingsRuntimeSnapshot } from '../game/settings/settingsRuntime'

export function PlayerHitVignette() {
  const element = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const update = (deltaSeconds: number) => {
      const opacity = stepPlayerHitVignette(
        deltaSeconds,
        getSettingsRuntimeSnapshot().reduceMotion,
      )
      if (element.current) element.current.style.opacity = opacity.toFixed(4)
    }
    const unsubscribeClock = subscribePausableClock(update)
    const unsubscribeTrigger = subscribePlayerHitVignette(() => update(0))
    return () => {
      unsubscribeClock()
      unsubscribeTrigger()
    }
  }, [])

  return (
    <div
      ref={element}
      className="player-hit-vignette"
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 22,
        pointerEvents: 'none',
        opacity: 0,
        background: `radial-gradient(circle, transparent 48%, ${FEEL.hitFlash.player.color} 100%)`,
      }}
    />
  )
}
