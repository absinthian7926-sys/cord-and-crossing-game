import { useEffect, useLayoutEffect, useSyncExternalStore } from 'react'
import { FEEL } from '../data/feel'
import { ZONE } from '../data/zone'
import { setGameplayInputLock } from '../game/player/input'
import {
  beginPendingSceneLoad,
  getSceneRuntimeSnapshot,
  subscribeSceneRuntime,
} from '../game/scenes/sceneRuntime'
import {
  getSettingsRuntimeSnapshot,
  subscribeSettingsRuntime,
} from '../game/settings/settingsRuntime'

export function SceneTransitionOverlay() {
  const snapshot = useSyncExternalStore(
    subscribeSceneRuntime,
    getSceneRuntimeSnapshot,
    getSceneRuntimeSnapshot,
  )
  const settings = useSyncExternalStore(
    subscribeSettingsRuntime,
    getSettingsRuntimeSnapshot,
    getSettingsRuntimeSnapshot,
  )

  useLayoutEffect(() => {
    setGameplayInputLock('scene-transition', snapshot.phase !== 'idle')
  }, [snapshot.phase])

  useEffect(() => () => setGameplayInputLock('scene-transition', false), [])

  useEffect(() => {
    if (snapshot.phase !== 'flashing') return
    const timeout = window.setTimeout(
      beginPendingSceneLoad,
      ZONE.portico.flashSeconds * 1_000,
    )
    return () => window.clearTimeout(timeout)
  }, [snapshot.phase, snapshot.revision])

  return (
    <>
      {snapshot.phase === 'flashing' && (
        <div
          className="crossing-flash"
          aria-hidden="true"
          style={
            {
              '--crossing-flash-peak': settings.reduceMotion
                ? FEEL.reduceMotion.crossingFlashPeakOpacity
                : 1,
            } as React.CSSProperties
          }
        />
      )}
      <div
        className={`scene-loading${settings.reduceMotion ? ' reduce-motion' : ''}${snapshot.phase === 'loading' ? ' is-visible' : ''}`}
        role={snapshot.phase === 'loading' ? 'status' : undefined}
        aria-live={snapshot.phase === 'loading' ? 'polite' : undefined}
        aria-hidden={snapshot.phase !== 'loading'}
      >
        <div className="scene-loading-panel">{ZONE.hollow.loadingText}</div>
      </div>
    </>
  )
}
