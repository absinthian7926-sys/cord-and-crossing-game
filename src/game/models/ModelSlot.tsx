import { useGLTF } from '@react-three/drei'
import type { ThreeElements } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, type ReactNode } from 'react'
import { Mesh, type AnimationClip, type Material, type Object3D } from 'three'
import { MODEL_ASSETS, type ModelId } from '../../data/models'
import { useModelAvailability } from './modelAvailability'

function cloneMaterial(material: Material | Material[]): Material | Material[] {
  return Array.isArray(material)
    ? material.map((entry) => entry.clone())
    : material.clone()
}

type LoadedModelProps = {
  readonly path: string
  readonly uniqueMaterials: boolean
  readonly onReady?: (
    object: Object3D,
    animations: readonly AnimationClip[],
  ) => void
}

function LoadedModel({ path, uniqueMaterials, onReady }: LoadedModelProps) {
  const { scene, animations } = useGLTF(path, false, true)
  const object = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse((child) => {
      if (!(child instanceof Mesh)) return
      child.castShadow = true
      child.receiveShadow = true
      if (uniqueMaterials) child.material = cloneMaterial(child.material)
    })
    return clone
  }, [scene, uniqueMaterials])

  useEffect(() => onReady?.(object, animations), [animations, object, onReady])
  return <primitive object={object} dispose={null} />
}

export type ModelSlotProps = Omit<ThreeElements['group'], 'children'> & {
  readonly model: ModelId
  readonly fallback: ReactNode
  readonly loadedScale?: number
  readonly uniqueMaterials?: boolean
  readonly onReady?: (
    object: Object3D,
    animations: readonly AnimationClip[],
  ) => void
}

export function ModelSlot({
  model,
  fallback,
  loadedScale = 1,
  uniqueMaterials = false,
  onReady,
  ...groupProps
}: ModelSlotProps) {
  const definition = MODEL_ASSETS[model]
  const availability = useModelAvailability(model)

  return (
    <group {...groupProps} name={`model-${definition.id}`}>
      {availability === 'ready' ? (
        <Suspense fallback={fallback}>
          <group
            position={[
              definition.offset[0] * loadedScale,
              definition.offset[1] * loadedScale,
              definition.offset[2] * loadedScale,
            ]}
            scale={definition.scale * loadedScale}
          >
            <LoadedModel
              path={definition.path}
              uniqueMaterials={uniqueMaterials}
              onReady={onReady}
            />
          </group>
        </Suspense>
      ) : (
        fallback
      )}
    </group>
  )
}
