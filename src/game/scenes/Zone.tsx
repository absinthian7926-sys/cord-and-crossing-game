import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { CameraRig } from '../player/CameraRig'
import { PlayerController } from '../player/PlayerController'
import { TrainingDummies } from '../combat/TrainingDummies'
import { CordWeapon } from '../weapons/CordWeapon'
export function Zone() {
  return (
    <>
      <color attach="background" args={['#91a3a4']} />
      <fog attach="fog" args={['#91a3a4', 35, 95]} />
      <ambientLight intensity={0.65} />
      <directionalLight
        castShadow
        color="#ffd6a0"
        intensity={2.2}
        position={[-18, 24, -12]}
        shadow-mapSize={[2048, 2048]}
      />
      <RigidBody type="fixed" colliders={false} name="test-ground">
        <CuboidCollider args={[40, 0.1, 40]} position={[0, -0.1, 0]} />
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[80, 80]} />
          <meshStandardMaterial color="#66705f" roughness={1} />
        </mesh>
      </RigidBody>
      <gridHelper
        args={[80, 80, '#7d8778', '#5b6457']}
        position={[0, 0.01, 0]}
      />
      <PlayerController />
      <CordWeapon />
      <TrainingDummies />
      <CameraRig />
    </>
  )
}
