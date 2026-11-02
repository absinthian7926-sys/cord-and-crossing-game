import { useGLTF } from '@react-three/drei'
import type { ThreeElements } from '@react-three/fiber'
import { Component, Suspense, useEffect, useMemo, type ReactNode } from 'react'
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  type AnimationClip,
  type Material,
  type Object3D,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { MODEL_ASSETS, type ModelId } from '../../data/models'
import {
  recordModelLoaded,
  reportModelFailure,
  useModelAvailability,
} from './modelAvailability'

const EMPTY_GEOMETRY = new BufferGeometry()
const mergedCharacterGeometry = new Map<ModelId, BufferGeometry>()
const mergedCharacterMaterial = new Map<ModelId, MeshStandardMaterial>()
const bodyColor = new Color()
const inverseRoot = new Matrix4()
const relativeTransform = new Matrix4()

function addMaterialColor(geometry: BufferGeometry, material: Material): void {
  const position = geometry.getAttribute('position')
  const color =
    material instanceof MeshStandardMaterial
      ? material.color
      : bodyColor.set(0xffffff)
  const values = new Float32Array(position.count * 3)
  for (let vertex = 0; vertex < position.count; vertex += 1) {
    const offset = vertex * 3
    values[offset] = color.r
    values[offset + 1] = color.g
    values[offset + 2] = color.b
  }
  geometry.setAttribute('color', new Float32BufferAttribute(values, 3))
}

function optimizeEnemyModel(object: Object3D, model: ModelId): void {
  if (model !== 'roadBrigand' && model !== 'brigandArcher') return
  const animationRoot = object.getObjectByName('pelvis')
  if (!animationRoot) return

  const preserved = new Set<Object3D>()
  for (const name of ['sword', 'buckler', 'leaderSash']) {
    const node = object.getObjectByName(name)
    node?.traverse((child) => preserved.add(child))
  }
  const bodyMeshes: Mesh[] = []
  animationRoot.traverse((child) => {
    if (child instanceof Mesh && !preserved.has(child)) bodyMeshes.push(child)
  })
  if (bodyMeshes.length < 2) return

  let geometry = mergedCharacterGeometry.get(model)
  if (!geometry) {
    object.updateMatrixWorld(true)
    inverseRoot.copy(animationRoot.matrixWorld).invert()
    const transformed: BufferGeometry[] = []
    for (const mesh of bodyMeshes) {
      const clone = mesh.geometry.clone()
      relativeTransform.multiplyMatrices(inverseRoot, mesh.matrixWorld)
      clone.applyMatrix4(relativeTransform)
      const material = Array.isArray(mesh.material)
        ? mesh.material[0]
        : mesh.material
      addMaterialColor(clone, material)
      transformed.push(clone)
    }
    geometry = mergeGeometries(transformed, false) ?? undefined
    for (const transformedGeometry of transformed) transformedGeometry.dispose()
    if (!geometry) return
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
    mergedCharacterGeometry.set(model, geometry)
  }

  for (const mesh of bodyMeshes) {
    if (mesh === animationRoot) mesh.geometry = EMPTY_GEOMETRY
    else mesh.removeFromParent()
  }
  const sourceMaterial = Array.isArray(bodyMeshes[0].material)
    ? bodyMeshes[0].material[0]
    : bodyMeshes[0].material
  let material = mergedCharacterMaterial.get(model)
  if (!material) {
    material = new MeshStandardMaterial({
      color: 0xffffff,
      metalness:
        sourceMaterial instanceof MeshStandardMaterial
          ? sourceMaterial.metalness
          : undefined,
      roughness:
        sourceMaterial instanceof MeshStandardMaterial
          ? sourceMaterial.roughness
          : undefined,
      vertexColors: true,
    })
    mergedCharacterMaterial.set(model, material)
  }
  const body = new Mesh(geometry, material)
  body.name = 'optimized-body'
  body.castShadow = true
  body.receiveShadow = true
  animationRoot.add(body)
}

type LoadedModelProps = {
  readonly model: ModelId
  readonly path: string
  readonly onReady?: (
    object: Object3D,
    animations: readonly AnimationClip[],
  ) => void
}

function LoadedModel({ model, path, onReady }: LoadedModelProps) {
  const { scene, animations } = useGLTF(path, false, true)
  const object = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse((child) => {
      if (!(child instanceof Mesh)) return
      child.castShadow = true
      child.receiveShadow = true
    })
    optimizeEnemyModel(clone, model)
    return clone
  }, [model, scene])

  useEffect(() => {
    recordModelLoaded(model)
    onReady?.(object, animations)
  }, [animations, model, object, onReady])
  return <primitive object={object} dispose={null} />
}

export type ModelSlotProps = Omit<ThreeElements['group'], 'children'> & {
  readonly model: ModelId
  readonly fallback: ReactNode
  readonly loadedScale?: number
  readonly onReady?: (
    object: Object3D,
    animations: readonly AnimationClip[],
  ) => void
}

type ModelErrorBoundaryProps = {
  readonly path: string
  readonly fallback: ReactNode
  readonly children: ReactNode
}

type ModelErrorBoundaryState = { readonly failed: boolean }

class ModelErrorBoundary extends Component<
  ModelErrorBoundaryProps,
  ModelErrorBoundaryState
> {
  state: ModelErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): ModelErrorBoundaryState {
    return { failed: true }
  }

  componentDidCatch(): void {
    reportModelFailure(this.props.path)
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

export function ModelSlot({
  model,
  fallback,
  loadedScale = 1,
  onReady,
  ...groupProps
}: ModelSlotProps) {
  const definition = MODEL_ASSETS[model]
  const availability = useModelAvailability(model)

  return (
    <group {...groupProps} name={`model-${definition.id}`}>
      {availability === 'ready' ? (
        <ModelErrorBoundary
          key={definition.path}
          path={definition.path}
          fallback={fallback}
        >
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
                model={model}
                path={definition.path}
                onReady={onReady}
              />
            </group>
          </Suspense>
        </ModelErrorBoundary>
      ) : (
        fallback
      )}
    </group>
  )
}
