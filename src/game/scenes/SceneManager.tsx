import { lazy, useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { CameraRig } from '../player/CameraRig'
import { PlayerController } from '../player/PlayerController'
import { CordWeapon } from '../weapons/CordWeapon'
import { EffectController } from '../effects/EffectController'
import { HollowEncounter } from '../hollow/HollowEncounter'
import { handlePorticoCrossing } from '../portico/porticoGameplay'
import {
  getSceneRuntimeSnapshot,
  markSceneReady,
  subscribeSceneRuntime,
} from './sceneRuntime'
import { Zone } from './Zone'

const Hollow = lazy(() => import('./Hollow'))

function SceneReady({ children }: { readonly children: ReactNode }) {
  useEffect(() => markSceneReady(), [])
  return children
}

function HollowScene() {
  return (
    <SceneReady>
      <Hollow onReturnCrossing={handlePorticoCrossing}>
        <PlayerController />
        <CordWeapon />
        <HollowEncounter />
        <CameraRig />
      </Hollow>
    </SceneReady>
  )
}

export function SceneManager() {
  const scene = useSyncExternalStore(
    subscribeSceneRuntime,
    getSceneRuntimeSnapshot,
    getSceneRuntimeSnapshot,
  ).currentScene

  return (
    <>
      <EffectController />
      {scene === 'zone' ? (
        <SceneReady>
          <Zone />
        </SceneReady>
      ) : (
        <HollowScene />
      )}
    </>
  )
}
