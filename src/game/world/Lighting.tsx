import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { DirectionalLight, Object3D } from 'three'
import { ZONE } from '../../data/zone'
import { playerStore } from '../player/playerStore'
import {
  getSettingsRuntimeSnapshot,
  subscribeSettingsRuntime,
} from '../settings/settingsRuntime'

export function Lighting() {
  const sun = useRef<DirectionalLight>(null)
  const target = useMemo(() => new Object3D(), [])
  const quality = useSyncExternalStore(
    subscribeSettingsRuntime,
    getSettingsRuntimeSnapshot,
    getSettingsRuntimeSnapshot,
  ).quality
  const shadowMapSize = ZONE.lighting.shadowMapByQuality[quality]
  const shadowExtent = ZONE.lighting.shadowExtent
  const sunDistance = ZONE.lighting.shadowDistance

  useEffect(() => {
    const light = sun.current
    if (!light) return
    if (
      light.shadow.mapSize.width === shadowMapSize &&
      light.shadow.mapSize.height === shadowMapSize
    )
      return
    light.shadow.mapSize.set(shadowMapSize, shadowMapSize)
    light.shadow.map?.dispose()
    light.shadow.map = null
    light.shadow.needsUpdate = true
  }, [shadowMapSize])

  useFrame(() => {
    const light = sun.current
    if (!light) return
    const player = playerStore.getState().position
    target.position.set(player.x, player.y, player.z)
    light.position.set(
      player.x + ZONE.lighting.sunDirection[0] * sunDistance,
      player.y + ZONE.lighting.sunDirection[1] * sunDistance,
      player.z + ZONE.lighting.sunDirection[2] * sunDistance,
    )
    light.target = target
    target.updateMatrixWorld()
  })

  return (
    <>
      <color attach="background" args={[ZONE.fog.color]} />
      <fog attach="fog" args={[ZONE.fog.color, ZONE.fog.start, ZONE.fog.end]} />
      <hemisphereLight
        args={[
          ZONE.fog.color,
          ZONE.palette.terrain,
          ZONE.lighting.hemisphereIntensity,
        ]}
      />
      <primitive object={target} />
      <directionalLight
        ref={sun}
        castShadow
        color={ZONE.lighting.sunColor}
        intensity={ZONE.lighting.sunIntensity}
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-camera-left={-shadowExtent}
        shadow-camera-right={shadowExtent}
        shadow-camera-top={shadowExtent}
        shadow-camera-bottom={-shadowExtent}
        shadow-camera-far={sunDistance * 2}
        shadow-bias={ZONE.lighting.shadowBias}
      />
    </>
  )
}
