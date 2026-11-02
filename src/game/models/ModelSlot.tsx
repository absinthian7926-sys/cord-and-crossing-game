import { useGLTF } from '@react-three/drei'
import type { ThreeElements } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Mesh, type AnimationClip, type Material, type Object3D } from 'three'
import { MODEL_ASSETS, type ModelId } from '../../data/models'

type Availability = 'checking' | 'ready' | 'failed'

const availabilityRequests = new Map<string, Promise<boolean>>()
const warnedPaths = new Set<string>()

function requestAvailability(path: string): Promise<boolean> {
  const existing = availabilityRequests.get(path)
  if (existing) return existing
  const request = fetch(path, { method: 'HEAD' })
    .then((response) => response.ok)
    .catch(() => false)
  availabilityRequests.set(path, request)
  return request
}

function warnOnce(path: string): void {
  if (warnedPaths.has(path)) return
  warnedPaths.add(path)
  console.warn(`Model unavailable, using primitive fallback: ${path}`)
}

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
  const [availability, setAvailability] = useState<Availability>('checking')

  useEffect(() => {
    let current = true
    void requestAvailability(definition.path).then((available) => {
      if (!current) return
      if (!available) warnOnce(definition.path)
      setAvailability(available ? 'ready' : 'failed')
    })
    return () => {
      current = false
    }
  }, [definition.path])

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
