import { ZONE } from '../../data/zone'

export function Sea() {
  const centerX = ZONE.sea.coastX - ZONE.sea.width / 2

  return (
    <mesh
      name="west-sea"
      position={[centerX, ZONE.sea.level, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      frustumCulled
    >
      <planeGeometry args={[ZONE.sea.width, ZONE.sea.depth, 1, 1]} />
      <meshStandardMaterial
        color={ZONE.palette.sea}
        roughness={0.72}
        metalness={0.05}
        transparent
        opacity={0.92}
      />
    </mesh>
  )
}
