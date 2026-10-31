import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import { Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { PLAYER } from '../../data/player'
import { usePlayerStore } from './playerStore'
const target = new Vector3(),
  previous = new Vector3(PLAYER.camera.shoulderOffset, 1.35, 0),
  delta = new Vector3()
export function CameraRig() {
  const controls = useRef<OrbitControlsImpl>(null)
  const { camera } = useThree()
  useFrame(() => {
    const p = usePlayerStore.getState().position
    target.set(p.x + PLAYER.camera.shoulderOffset, p.y + 0.45, p.z)
    delta.copy(target).sub(previous)
    camera.position.add(delta)
    controls.current?.target.copy(target)
    controls.current?.update()
    previous.copy(target)
  })
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.12}
      minDistance={PLAYER.camera.minimumDistance}
      maxDistance={PLAYER.camera.maximumDistance}
      maxPolarAngle={Math.PI * 0.48}
      minPolarAngle={Math.PI * 0.15}
      target={[PLAYER.camera.shoulderOffset, 1.35, 0]}
    />
  )
}
