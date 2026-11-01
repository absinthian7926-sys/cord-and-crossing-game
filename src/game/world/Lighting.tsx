import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { DirectionalLight, Object3D } from 'three'
import { ZONE } from '../../data/zone'
import { playerStore } from '../player/playerStore'

export function Lighting() {
  const sun = useRef<DirectionalLight>(null)
  const target = useMemo(() => new Object3D(), [])
  const quality = ZONE.quality.default
  const shadowMapSize = ZONE.lighting.shadowMapByQuality[quality]
  const shadowExtent = ZONE.lighting.shadowExtent
  const sunDistance = ZONE.lighting.shadowDistance

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
