import { useEffect, useLayoutEffect, useSyncExternalStore } from 'react'
import { ZONE } from '../data/zone'
import { setGameplayInputLock } from '../game/player/input'
import {
  beginPendingSceneLoad,
  getSceneRuntimeSnapshot,
  subscribeSceneRuntime,
} from '../game/scenes/sceneRuntime'

export function SceneTransitionOverlay() {
  const snapshot = useSyncExternalStore(
    subscribeSceneRuntime,
    getSceneRuntimeSnapshot,
    getSceneRuntimeSnapshot,
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
        <div className="crossing-flash" aria-hidden="true" />
      )}
      {snapshot.phase === 'loading' && (
        <div className="scene-loading" role="status" aria-live="polite">
          <div className="scene-loading-panel">{ZONE.hollow.loadingText}</div>
        </div>
      )}
    </>
  )
}
